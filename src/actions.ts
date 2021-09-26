// Copyright (c) 2021 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { DirectTalk, DirectTalkType, DirectUser, Response, SendableContent } from './daab';
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
} from './workflow';

export interface Action {
  execute(): Promise<void>;
}

export class MessageAction implements Action {
  constructor(
    readonly action: DefaultActionType,
    readonly args: DefaultActionWith,
    readonly to: string | undefined,
    readonly res: Response<any>,
    readonly context: WorkflowContext
  ) {}

  private getTargetTalk() {
    const talks = this.res.robot.brain.rooms();
    const isPairTalk = (talk: DirectTalk) => talk.type === 1; // DirectTalkType.Pair;
    const areYouTarget = (user: DirectUser) => user.displayName === this.to;

    const talk = Object.values(talks)
      .filter(isPairTalk)
      .find((t) => t.users.some(areYouTarget));
    if (!talk) {
      throw new Error(`destination talk not found: ${this.to}`);
    }

    return talk;
  }

  private getTargetUser(talk: DirectTalk) {
    const found = talk.users.find((u) => u.displayName === this.to);
    if (!found) {
      throw new Error(`destination talk not found: ${this.to}`);
    }
    return found;
  }

  execute(): Promise<void> {
    const content = this.createContent(this.action, this.args);
    if (this.to) {
      const talk = this.getTargetTalk();
      this.res.robot.send({ room: talk.id }, content);
    } else {
      this.res.send(content);
    }
    return Promise.resolve();
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
