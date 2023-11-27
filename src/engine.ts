// Copyright (c) 2021 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import fs from 'fs';
import handlebars from 'handlebars';
import path from 'path';
import * as uuid from 'uuid';
import yaml from 'js-yaml';
import { Action, CustomAction, MessageAction, NoopAction } from './actions';
import { parseTrigger, isTriggerFired } from './triggers';
import type { Robot, TextMessage, LeaveMessage } from 'lisb-hubot';
import type {
  Direct,
  Response,
  ResponseWithJson,
  SelectWithResponse,
  TaskWithResponse,
  YesNoWithResponse,
  NoteCreated,
  NoteUpdated,
  NoteDeleted,
  JoinMessage,
} from 'hubot-direct';
import {
  DefaultAction,
  isDefaultAction,
  Workflow,
  WorkflowStep,
  DefaultActionWith,
  isCustomAction,
  getCustomActionName,
  WorkflowEvent,
  WorkflowEventType,
  WorkflowEventWith,
} from './workflow';
import { Repository } from './repository';
import { logger } from '.';

require('handlebars-helpers')();

type UserId = string;

export class Workflows {
  constructor(
    private readonly docs: Map<string, Workflow>,
    private readonly repository: Repository
  ) {}

  static init(dirPath: string, repository: Repository): Workflows {
    const filenames = fs
      .readdirSync(dirPath)
      .filter((e) => ['.yml', '.yaml'].includes(path.extname(e)))
      .map((e) => path.join(dirPath, e));

    const docs = new Map<string, Workflow>();
    filenames.forEach((fn) => {
      const w = this.parse(yaml.load(fs.readFileSync(fn, 'utf8')));
      if (this.validate(w)) {
        docs.set(w.name, w);
      } else {
        throw new Error(`invalid workflow: ${fn}`);
      }
    });
    return new Workflows(docs, repository);
  }

  static parse(w: any): Workflow {
    if (w) {
      w.on = parseTrigger(w.on);
    }
    return w;
  }

  static validate(obj: Workflow): boolean {
    return (
      typeof obj === 'object' &&
      typeof obj.version === 'number' &&
      !!obj.version &&
      typeof obj.name === 'string' &&
      !!obj.name &&
      Array.isArray(obj.steps) &&
      typeof obj.on === 'object'
    );
  }

  getNames(): string[] {
    return Array.from(this.docs.keys()).sort();
  }

  getSelectableNames(): string[] {
    return this.filterByEvent(WorkflowEvent.WorkflowDispatch).map((workflow) => workflow.name);
  }

  filterByEvent(type: WorkflowEventType, e?: WorkflowEventWith): Workflow[] {
    return this.getNames()
      .map((name) => this.findByName(name)!)
      .filter((workflow) => isTriggerFired(type, workflow.on[type], e));
  }

  findByName(name: string): Workflow | undefined {
    return this.docs.get(name);
  }

  createWorkflowContext(name: string): WorkflowContext | undefined {
    const workflow = this.findByName(name);
    if (workflow) {
      return WorkflowContext.create(workflow, this.repository);
    }
    return undefined;
  }

  createWorkflowContextByEvent(
    type: WorkflowEventType,
    e?: WorkflowEventWith
  ): WorkflowContext | undefined {
    const workflow = this.filterByEvent(type, e);
    if (workflow.length) {
      return WorkflowContext.create(workflow[0], this.repository);
    }
  }
}

// * NOTE: Hubot の Listener 処理が Promise に対応していないため，daab-session を使わずに別途設けることになった
export class UserSession {
  constructor(
    readonly talkId: string,
    readonly userId: string,
    private _selecting: boolean = false
  ) {}

  static restore(obj: unknown) {
    if (this.validate(obj)) {
      return new UserSession(obj.talkId, obj.userId, obj._selecting);
    }
    return undefined;
  }

  private static validate(obj: any): obj is UserSession {
    return !!obj && obj.talkId && obj.userId;
  }

  get selecting() {
    return this._selecting;
  }
  set selecting(b: boolean) {
    this._selecting = b;
  }
}

export class UserContext {
  public readonly id: string;
  private currentWorkflowContextId: string | undefined;

  constructor(private readonly userId: UserId) {
    this.id = userId;
    this.currentWorkflowContextId = undefined;
  }

  static restore(obj: unknown) {
    if (!this.validate(obj)) {
      return undefined;
    }
    const uc = new UserContext(obj.userId);
    uc.currentWorkflowContextId = obj.currentWorkflowContextId;
    return uc;
  }

  private static validate(obj: any): obj is UserContext {
    return !!obj.id;
  }

  join(wc: WorkflowContext) {
    wc.addActor(this);
    this.currentWorkflowContextId = wc.id;
  }

  getCurrentWorkflowContextId(): string | undefined {
    return this.currentWorkflowContextId;
  }

  clearCurrentWorkflowContextId() {
    this.currentWorkflowContextId = undefined;
  }
}

type WorkflowContextId = string;
type WorkflowStepData = { [key: string]: any };

export class WorkflowContext {
  private valid = true;
  private stepIndex = 0;
  private data: WorkflowStepData = {};
  private readonly firstStep = { id: 'on' } as WorkflowStep;
  private readonly actors = new Set<string>();

  private constructor(
    public readonly id: WorkflowContextId,
    private readonly workflow: Workflow,
    private readonly repository: Repository
  ) {}

  state() {
    return {
      id: this.id,
      workflow: this.workflow,
      valid: this.valid,
      stepIndex: this.stepIndex,
      data: this.data,
      actors: this.actors,
    };
  }

  static create(workflow: Workflow, repository: Repository): WorkflowContext {
    return new WorkflowContext(uuid.v4(), workflow, repository);
  }

  static restore(obj: unknown, repository: Repository): WorkflowContext | undefined {
    if (!this.validate(obj)) {
      return undefined;
    }
    const ctx = new WorkflowContext(obj.id, obj.workflow, repository);
    ctx.valid = obj.valid;
    ctx.stepIndex = obj.stepIndex;
    ctx.data = obj.data;
    return ctx;
  }

  private static validate(obj: any): obj is WorkflowContext {
    return obj && obj.id && Workflows.validate(obj.workflow);
  }

  addActor(uc: UserContext) {
    this.actors.add(uc.id);
  }

  isActive() {
    return this.valid;
  }
  activate() {
    this.valid = true;
  }
  deactivate() {
    this.valid = false;
  }

  private reset() {
    this.stepIndex = 0;
    this.data = {};
  }

  private resetByEvent(type: WorkflowEventType) {
    this.stepIndex = -1;
    this.data = {};
    this.firstStep.action = `daab:message:${type.split('_')[0]}`;
  }

  private get currentStep() {
    if (this.stepIndex === -1) return this.firstStep;
    return this.workflow.steps[this.stepIndex];
  }
  private get isLastStep() {
    return this.workflow.steps.length - 1 <= this.stepIndex;
  }

  private goNextStep() {
    return this.workflow.steps[++this.stepIndex];
  }

  private evaluateActionWith(actionWith: unknown): DefaultActionWith {
    if (typeof actionWith === 'string') {
      actionWith = yaml.load(actionWith);
    }
    if (typeof actionWith !== 'object') {
      actionWith = {};
    }
    return actionWith as DefaultActionWith;
  }

  private evaluateWorkflowStep(step: WorkflowStep): WorkflowStep {
    const wstep = yaml.load(handlebars.compile(yaml.dump(step))(this.data)) as WorkflowStep;
    if (wstep.nowait === undefined) {
      wstep.nowait = this.workflow.defaults?.nowait;
    }
    if (typeof wstep.if === 'string') {
      wstep.if = (wstep.if as string).toLowerCase() === 'true';
    }
    wstep.with = this.evaluateActionWith(wstep.with);
    return wstep;
  }

  private evaluateWorkflowAction(wstep: WorkflowStep, res: Response<any>): Action {
    const action = wstep.action;
    const args = wstep.with as DefaultActionWith;
    if (isDefaultAction(action)) {
      return new MessageAction(action, args, args.to, res);
    }
    if (isCustomAction(action)) {
      return new CustomAction(getCustomActionName(action), args, res);
    }
    if (!action) {
      return new NoopAction(action, args);
    }
    throw new Error('Action is not implemented.');
  }

  private getUserId(res: Response<any>, step: WorkflowStep) {
    const args = step.with as { to?: string }; // ! FIXME
    // FIXME
    const obj = (res as any).robot.direct.api.dataStore.me.id;
    const botId = `_${obj.high}_${obj.low}`;
    let userId: string = res.message.user.id;
    if (userId == botId) {
      userId = res.message.roomUsers.find((user: any) => user.id !== botId)?.id;
    }
    return this.findUserId(res, args.to)?.id ?? userId;
  }

  private async findOrCreateUserContext(userId: string) {
    let uc = await this.repository.findUserContextByUserId(userId);
    if (uc) {
      return uc;
    }
    return new UserContext(userId);
  }

  private async runNextAction(res: Response<any>) {
    const next = this.goNextStep();
    logger.debug({ next });

    if (next) {
      await this.runCurrentStep(res);
    } else {
      await this.exitWorkflow();
    }
  }

  private async runCurrentStep(res: Response<any>) {
    const step = this.evaluateWorkflowStep(this.currentStep);
    logger.debug({ evaluated: step });
    if (step.if != undefined && step.if === false) {
      this.runNextAction(res);
      return;
    }

    const userId = this.getUserId(res, step);
    const uc = await this.findOrCreateUserContext(userId);
    uc.join(this);
    await this.repository.saveUserContext(uc);
    await this.repository.saveWorkflowContext(this);

    const action = this.evaluateWorkflowAction(step, res);
    let error;
    const ar = await action.execute().catch((e) => logger.error((error = e)));
    logger.debug({ executed: ar });
    if (ar && step.id) {
      this.data[step.id] = {
        ...this.data[step.id],
        response: ar.data,
      };
    }
    if (step.exitFlow || this.isLastStep || error) {
      await this.exitWorkflow();
      return;
    }
    if (step.nowait) {
      this.runNextAction(res);
      return;
    }
  }

  private findUserId<R extends Response<any>>(res: R, to: string | undefined) {
    if (!to) {
      return undefined;
    }
    const robot = (res as any).robot as Robot<Direct>;
    return Object.values(robot.brain.users()).filter((u) => u.displayName === to)[0];
  }

  // NOTE: このメソッドは respond('select', ...) からのみ呼び出される
  async startWokflow(res: ResponseWithJson<SelectWithResponse>): Promise<void> {
    this.reset();
    this.activate();

    await this.runCurrentStep(res);
  }

  async triggerWorkflow(type: WorkflowEventType) {
    this.resetByEvent(type);
    this.activate();
  }

  private async exitWorkflow() {
    this.reset();
    this.deactivate();

    const actorIds = Array.from(this.actors.keys());
    this.actors.clear();
    const effs = actorIds.map(async (id) => {
      const uc = await this.repository.findUserContextByUserId(id);
      if (uc) {
        uc.clearCurrentWorkflowContextId();
        this.repository.saveUserContext(uc);
      }
    });

    await Promise.all(effs);
    await this.repository.destroy(this);
  }

  async cancelWorkflow() {
    return this.exitWorkflow();
  }

  async handleSelect(res: ResponseWithJson<SelectWithResponse>) {
    const current = this.currentStep;
    if (current.action != DefaultAction.Select) {
      return;
    }

    if (current.id) {
      this.data[current.id] = {
        responder: res.message.user,
        ...res.json,
        response: res.json.response!, // TODO: 必ずあるから ? を取り除く
      };
    }

    await this.runNextAction(res);
  }

  async handleText(res: Response<TextMessage>) {
    const current = this.currentStep;
    if (current.action != DefaultAction.Text) {
      return;
    }

    if (current.id) {
      this.data[current.id] = {
        responder: res.message.user,
        response: res.message.text.replace(/^Hubot /i, '').replace(/^@.*\sさん\s/, ''),
      };
    }

    await this.runNextAction(res);
  }

  async handleYesNo(res: ResponseWithJson<YesNoWithResponse>) {
    const current = this.currentStep;
    if (current.action != DefaultAction.YesNo) {
      return;
    }

    if (current.id) {
      this.data[current.id] = {
        responder: res.message.user,
        ...res.json,
        response: res.json.response!, // NOTE: 必ずあるから ? を取り除く
      };
    }

    await this.runNextAction(res);
  }

  async handleTask(res: ResponseWithJson<TaskWithResponse>) {
    const current = this.currentStep;
    if (current.action != DefaultAction.Task) {
      return;
    }

    if (current.id) {
      this.data[current.id] = {
        responder: res.message.user,
        ...res.json,
        response: res.json.done!, // NOTE: 必ずあるから ? を取り除く
      };
    }

    await this.runNextAction(res);
  }

  async handleNoteCreated(res: ResponseWithJson<NoteCreated>) {
    const current = this.currentStep;
    if (current.action != DefaultAction.Note) {
      return;
    }

    if (current.id) {
      this.data[current.id] = {
        responder: res.message.user,
        ...res.json,
        response: { note: res.json },
      };
    }

    await this.runNextAction(res);
  }

  async handleNoteUpdated(res: ResponseWithJson<NoteUpdated>) {
    const current = this.currentStep;
    if (current.action != DefaultAction.Note) {
      return;
    }

    if (current.id) {
      this.data[current.id] = {
        responder: res.message.user,
        ...res.json,
        response: { note: res.json },
      };
    }

    await this.runNextAction(res);
  }

  async handleNoteDeleted(res: ResponseWithJson<NoteDeleted>) {
    const current = this.currentStep;
    if (current.action != DefaultAction.Note) {
      return;
    }

    if (current.id) {
      this.data[current.id] = {
        responder: res.message.user,
        ...res.json,
        response: { note: res.json },
      };
    }

    await this.runNextAction(res);
  }

  async handleJoin(res: Response<JoinMessage>) {
    const current = this.currentStep;
    if (current.action != 'daab:message:join') {
      return;
    }

    if (current.id) {
      this.data[current.id] = {
        responder: res.message.user,
      };
    }

    await this.runNextAction(res);
  }

  async handleLeave(res: Response<LeaveMessage>) {
    const current = this.currentStep;
    if (current.action != 'daab:message:leave') {
      return;
    }

    if (current.id) {
      this.data[current.id] = {
        responder: res.message.user,
      };
    }

    await this.runNextAction(res);
  }
}
