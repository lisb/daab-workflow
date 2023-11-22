// Copyright (c) 2021 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { Response } from './daab';
import { UserSession, Workflows } from './engine';

const commands = ['help', 'list', 'status', 'abort'] as const;
type BotCommand = typeof commands[number];

function isCommand(s: string): s is BotCommand {
  return commands.some((c) => c === s);
}

interface CommandAction {
  run(res: Response<any>, session: UserSession): void;
}

export class Commands {
  constructor(private readonly workflows: Workflows) {}

  parse(s: string): CommandAction | undefined {
    if (s.startsWith('/')) {
      const ss = s.substring(1);
      if (isCommand(ss)) {
        return this.createCommand(ss);
      }
    }
    return undefined;
  }

  createCommand(command: BotCommand): CommandAction {
    const workflows = this.workflows;
    switch (command) {
      case 'list':
        return new (class {
          run(res: Response<any>, session: UserSession): void {
            if (session.selecting) {
              res.send('ワークフローの選択中です。');
            } else {
              session.selecting = true;
              res.send({
                question: 'ワークフローを選択してください。',
                options: workflows.getSelectableNames(),
              });
            }
          }
        })();
      case 'status':
        return new (class {
          run(res: Response<any>): void {
            res.send('no impl');
          }
        })();
      case 'abort':
        return new (class {
          run(res: Response<any>): void {
            // TODO: res.session?.invalidate();
            res.send('no impl');
          }
        })();
    }
    throw new Error(`unknown command: ${command}`);
  }
}
