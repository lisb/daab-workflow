// Copyright (c) 2021 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { Robot } from 'lisb-hubot';
import type { Direct, Response, SendableContent } from 'hubot-direct';
import type { Talk, User } from 'hubot-direct/types/direct-js';
import { WorkflowContext } from './engine';
import {
  DefaultAction,
  DefaultActionType,
  isDaabMessageSelectArgs,
  isDaabMessageTextArgs,
  DefaultActionWith,
  WorkflowStepDefaultActionWith,
  isDaabMessageYesNoArgs,
  isDaabMessageTaskArgs,
  isDaabMessageFileArgs,
  isDaabMessageFilesArgs,
} from './workflow';

export class ActionResponse {
  constructor(public readonly data: unknown = {}) {}
}

export interface Action {
  execute(): Promise<ActionResponse | undefined>;
}

export class NoopAction implements Action {
  constructor(private readonly name: string, private readonly args: unknown) {}
  async execute(): Promise<any> {
    return this.args;
  }
}

export class MessageAction implements Action {
  robot: Robot<Direct>;

  constructor(
    readonly action: DefaultActionType,
    readonly args: DefaultActionWith,
    readonly to: string | undefined,
    readonly res: Response<any>
  ) {
    this.robot = (this.res as any).robot;
  }

  private getTargetTalk() {
    const talks = this.robot.brain.rooms();
    const isPairTalk = (talk: Talk) => talk.type === 1; // DirectTalkType.Pair;
    const areYouTarget = (user: User) => user.displayName === this.to;

    const talk = Object.values(talks)
      .filter(isPairTalk)
      .find((t) => t.users.some(areYouTarget));
    if (!talk) {
      throw new Error(`destination talk not found: ${this.to}`);
    }

    return talk;
  }

  private getTargetUser(talk: Talk) {
    const found = talk.users.find((u) => u.displayName === this.to);
    if (!found) {
      throw new Error(`destination talk not found: ${this.to}`);
    }
    return found;
  }

  async execute(): Promise<ActionResponse | undefined> {
    const content = this.createContent(this.action, this.args);
    if (this.to) {
      const talk = this.getTargetTalk();
      this.robot.send({ room: talk.id }, content);
    } else {
      this.res.send(content);
    }
    return undefined;
  }

  // ! FIXME: 実装が雑
  private createContent(action: DefaultActionType, args: DefaultActionWith): SendableContent {
    if (isDaabMessageSelectArgs(action, args)) {
      return {
        question: args.question,
        options: args.options,
      };
    }
    if (isDaabMessageTextArgs(action, args)) {
      return { text: args.text };
    }
    if (isDaabMessageFileArgs(action, args)) {
      return { path: args.path, name: args.name, type: args.type, text: args.text };
    }
    if (isDaabMessageFilesArgs(action, args)) {
      return { path: args.path, name: args.name, type: args.type, text: args.text };
    }
    if (isDaabMessageYesNoArgs(action, args)) {
      return {
        question: args.question,
      };
    }
    if (isDaabMessageYesNoArgs(action, args)) {
      return {
        question: args.question,
      };
    }
    if (isDaabMessageTaskArgs(action, args)) {
      return {
        title: args.title,
        closing_type: 0, // TODO
      };
    }
    throw new Error(`unknown action: ${action}`);
  }
}

type CustomActionFunction = (args: any, res?: Response<any>) => Promise<ActionResponse | undefined>;

export class CustomAction implements Action {
  private readonly f: CustomActionFunction;

  constructor(
    private readonly name: string,
    private readonly args: unknown,
    readonly res: Response<any>
  ) {
    const mod = require(name);
    this.f = mod.default ?? mod;
  }

  async execute(): Promise<ActionResponse | undefined> {
    return this.f(this.args, this.res);
  }
}
