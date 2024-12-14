// Copyright (c) 2021 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { Message, Robot, TextMessage } from 'lisb-hubot';
import type { Response, ResponseWithJson, SelectWithResponse } from 'hubot-direct';
import { Repository } from './repository';
import { UserContext, UserSession, Workflows } from './engine';
import { Commands } from './commands';
import { WorkflowEvent, WorkflowEventType } from './workflow';
import pino from 'pino';

export const logger = pino({ name: 'daab-workflow', level: process.env.HUBOT_LOG_LEVEL || 'info' });

const _middlewares =
  (repository: Repository) =>
  <M extends Message, R extends Response<M>>(f: (res: R, session: UserSession) => Promise<void>) =>
  async (res: R) => {
    const session = await repository.findOrCreateUserSession(res.message.room, res.message.user.id);
    try {
      await f(res, session);
      await repository.saveUserSession(session);
    } catch (err) {
      logger.error(err);
    } finally {
      // logger.debug({ finally: session });
    }
  };

export function workflow(dirPath: string) {
  const repository = new Repository();
  const workflows = Workflows.init(dirPath, repository);
  const commands = new Commands(workflows);
  const middlewares = _middlewares(repository);

  logger.info({ workflows_loaded: workflows.getNames() }); // TODO: delete

  async function findUser(res: Response<any>): Promise<UserContext | undefined> {
    const userId = res.message.user.id;
    return repository.findUserContextByUserId(userId);
  }

  async function findCurrentWorkflowContext<M extends Message>(
    res: Response<M>,
    type: WorkflowEventType
  ) {
    const uc = await findUser(res);
    // logger.debug({found_uc: uc});
    const wc = await repository.findWorkflowContext(uc?.getCurrentWorkflowContextId());
    // logger.debug({found_wc: wc});
    if (wc) {
      return wc;
    }
    const newContext = workflows.createWorkflowContextByEvent(type, res);
    if (newContext) {
      await newContext.triggerWorkflow(type);
      return newContext;
    }
  }

  async function startWorkflow(res: ResponseWithJson<SelectWithResponse>, workflows: Workflows) {
    const selectedName = res.json.options[res.json.response!];
    const newContext = workflows.createWorkflowContext(selectedName);
    if (newContext) {
      await newContext.startWokflow(res);
    } else {
      res.send(`選択されたワークフローがみつかりませんでした。 (${selectedName})`);
    }
  }

  function needToSkip(text: string) {
    try {
      const data = JSON.parse(text);
      const names = Object.getOwnPropertyNames(data);
      return names.some((n) => ['in_reply_to', 'question', 'title', 'stamp_index'].includes(n));
    } catch (_) {
      return false;
    }
  }

  const handlers = (robot: Robot) => {
    robot.hear(
      /(.+)$/i,
      middlewares(async (res, session) => {
        const text = res.match[1].replace(/^Hubot /i, '').replace(/^@.*\sさん\s/, '');
        // logger.debug({ text });
        if (needToSkip(text)) {
          return;
        }
        // logger.debug({ text: 'begin' });
        const command = commands.parse(text);
        if (command) {
          command.run(res, session);
        } else {
          const context = await findCurrentWorkflowContext(res, WorkflowEvent.Text);
          if (context && context.isActive()) {
            await context.handleText(res);
          }
        }
      })
    );

    robot.hear(
      'file',
      middlewares(async (res, session) => {
        // logger.debug('file');
        const context = await findCurrentWorkflowContext(res, WorkflowEvent.File);
        if (context && context.isActive()) {
          await context.handleFile(res);
        }
      })
    );

    robot.hear(
      'files',
      middlewares(async (res, session) => {
        // logger.debug('files');
        const context = await findCurrentWorkflowContext(res, WorkflowEvent.Files);
        if (context && context.isActive()) {
          await context.handleFiles(res);
        }
      })
    );

    robot.hear(
      'select',
      middlewares(async (res, session) => {
        // logger.debug('select');
        const context = await findCurrentWorkflowContext(res, WorkflowEvent.Select);
        if (context && context.isActive()) {
          await context.handleSelect(res);
        } else {
          if (session.selecting) {
            session.selecting = false;
            await startWorkflow(res, workflows);
          }
        }
      })
    );

    robot.hear(
      'task',
      middlewares(async (res, session) => {
        // logger.debug('task');
        const context = await findCurrentWorkflowContext(res, WorkflowEvent.Task);
        if (context && context.isActive()) {
          await context.handleTask(res);
        }
      })
    );

    robot.hear(
      'yesno',
      middlewares(async (res, session) => {
        // logger.debug('yesno');
        const context = await findCurrentWorkflowContext(res, WorkflowEvent.YesNo);
        if (context && context.isActive()) {
          await context.handleYesNo(res);
        }
      })
    );

    robot.hear(
      'note_created',
      middlewares(async (res, session) => {
        // logger.debug('note_created');
        const context = await findCurrentWorkflowContext(res, WorkflowEvent.NoteCreated);
        if (context && context.isActive()) {
          await context.handleNoteCreated(res);
        }
      })
    );

    robot.hear(
      'note_updated',
      middlewares(async (res, session) => {
        // logger.debug('note_updated');
        const context = await findCurrentWorkflowContext(res, WorkflowEvent.NoteUpdated);
        if (context && context.isActive()) {
          await context.handleNoteUpdated(res);
        }
      })
    );

    robot.hear(
      'note_deleted',
      middlewares(async (res, session) => {
        // logger.debug('note_deleted');
        const context = await findCurrentWorkflowContext(res, WorkflowEvent.NoteDeleted);
        if (context && context.isActive()) {
          await context.handleNoteDeleted(res);
        }
      })
    );

    robot.join(
      middlewares(async (res, session) => {
        // logger.debug('join');
        const context = await findCurrentWorkflowContext(res, WorkflowEvent.Join);
        if (context && context.isActive()) {
          await context.handleJoin(res);
        }
      })
    );

    robot.leave(
      middlewares(async (res, session) => {
        // logger.debug('leave');
        const context = await findCurrentWorkflowContext(res, WorkflowEvent.Leave);
        if (context && context.isActive()) {
          await context.handleLeave(res);
        }
        if (context) {
          await context.cancelWorkflow();
        }
      })
    );
  };

  return handlers;
}
