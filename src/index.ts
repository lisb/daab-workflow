// Copyright (c) 2021 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { DaabActions, withSession } from 'daab-session';
import { Workflows, WorkflowContext } from './workflow';

declare module 'daab-session' {
  interface SessionData {
    context: WorkflowContext;
  }
}

export function workflow(dirPath: string) {
  const workflows = Workflows.load(dirPath);
  console.info(workflows);

  const handlers: DaabActions = (robot) => {
    robot.respond(/(.+)$/i, (res) => {
      if (res.match[1] == '/list') {
        res.session?.invalidate();
        res.send({
          question: '申請を選択してください。',
          options: workflows.names,
        });
      } else {
        // TODO
      }
    });

    robot.respond('select', (res) => {});

  };
  return withSession(handlers);
}
