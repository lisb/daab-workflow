// Copyright (c) 2021 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import fs from 'fs';
import handlebars from 'handlebars';
import path from 'path';
import * as uuid from 'uuid';
import yaml from 'js-yaml';
import { Action, CustomAction, MessageAction } from './actions';
import {
  DirectUser,
  DirectTalk,
  DirectTalkType,
  Response,
  ResponseWithJson,
  SelectWithResponse,
  TaskWithResponse,
  TextMessage,
  YesNoWithResponse,
} from './daab';
import {
  DefaultAction,
  isDefaultAction,
  Workflow,
  WorkflowStep,
  DefaultActionWith,
  isCustomAction,
  getCustomActionName,
} from './workflow';
import { Repository } from './repository';

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
      const w = yaml.load(fs.readFileSync(fn, 'utf8'));
      if (this.validate(w)) {
        docs.set(w.name, w);
      } else {
        throw new Error(`invalid workflow: ${fn}`);
      }
    });
    return new Workflows(docs, repository);
  }

  static validate(obj: any): obj is Workflow {
    return typeof obj === 'object' && obj.version && obj.name && Array.isArray(obj.steps);
  }

  getNames(): string[] {
    return Array.from(this.docs.keys()).sort();
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

  private get currentStep() {
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
    return actionWith as DefaultActionWith;
  }

  private evaluateWorkflowStep(step: WorkflowStep, res: Response<any>): [WorkflowStep, Action] {
    const wstep = yaml.load(handlebars.compile(yaml.dump(step))(this.data)) as WorkflowStep;
    const action = wstep.action;
    const args = this.evaluateActionWith(wstep.with);
    if (isDefaultAction(action)) {
      return [wstep, new MessageAction(action, args, args.to, res)];
    }
    if (isCustomAction(action)) {
      return [wstep, new CustomAction(getCustomActionName(action), args)];
    }
    throw new Error('Action is not implemented.');
  }

  private getUserId(res: Response<any>, step: WorkflowStep) {
    const args = step.with as { to?: string }; // ! FIXME
    return this.findUserId(res, args.to)?.id ?? res.message.user.id;
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
    console.info('next:', next);

    if (next) {
      const [step, action] = this.evaluateWorkflowStep(next, res);
      if (step.if != undefined && step.if === false) {
        this.runNextAction(res);
        return;
      }

      const userId = this.getUserId(res, step);
      const uc = await this.findOrCreateUserContext(userId);
      uc.join(this);
      await this.repository.saveUserContext(uc);
      await this.repository.saveWorkflowContext(this);

      const ar = await action.execute();
      if (ar && step.id) {
        this.data[step.id] = {
          ...this.data[step.id],
          response: ar.data,
        };
      }
      if (step.nowait) {
        this.runNextAction(res);
        return;
      }

      if (step.exitFlow || this.isLastStep) {
        await this.exitWorkflow();
      }
    } else {
      await this.exitWorkflow();
    }
  }

  private findUserId<R extends Response<any>>(res: R, to: string | undefined) {
    if (!to) {
      return undefined;
    }
    return Object.values(res.robot.brain.users()).filter((u) => u.displayName === to)[0];
  }

  // NOTE: このメソッドは respond('select', ...) からのみ呼び出される
  async startWokflow(res: ResponseWithJson<SelectWithResponse>): Promise<void> {
    this.reset();
    this.activate();

    const [step, action] = this.evaluateWorkflowStep(this.currentStep, res);

    const userId = this.getUserId(res, step);
    const uc = await this.findOrCreateUserContext(userId);
    uc.join(this);
    await this.repository.saveUserContext(uc);
    await this.repository.saveWorkflowContext(this);

    const ar = await action.execute();
    if (ar && step.id) {
      this.data[step.id] = {
        ...this.data[step.id],
        response: ar.data,
      };
    }
    if (step.nowait) {
      this.runNextAction(res);
      return;
    }
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
        response: res.match[1],
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
}
