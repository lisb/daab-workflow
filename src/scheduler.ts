import cron from 'node-cron';
import { Response, Robot, TextMessage, User } from 'lisb-hubot';
import { ResponseWithJson, SelectResponse, SelectWithResponse } from 'hubot-direct';
import { Workflows } from './engine';
import { logger } from './index';

export class Scheduler {
  constructor(private readonly workflows: Workflows) { }
  tasks: cron.ScheduledTask[] = [];

  setup(robot: Robot) {
    const res = this.createSelectResponse(robot);
    this.tasks = [];
    this.workflows.getScheduledWorkflows().forEach((workflow) => {
      workflow.on.schedule!.forEach((schedule) => {
        if (cron.validate(schedule.cron)) {
          const task = cron.schedule(schedule.cron, async () => {
            await this.startWorkflow(res, workflow.name);
          });
          this.tasks.push(task);
        } else {
          logger.error(`invalid cron: ${schedule.cron}`);
        }
      });
    });
  }

  private async startWorkflow(res: ResponseWithJson<SelectWithResponse>, name: string) {
    logger.info('start workflow on schedule', name);
    const newContext = this.workflows.createWorkflowContext(name);
    if (newContext) {
      await newContext.startWokflow(res);
    }
  }

  // NOTE: startWokflow は respond('select', ...) からのみ呼び出される
  private createSelectResponse(robot: Robot<Hubot.Adapter>) {
    const json: SelectWithResponse = {
      question: '',
      options: [],
    };
    const msg = new TextMessage(new User('scheduler'), JSON.stringify(json), '');
    const res = new Response(robot, msg, undefined as any) as ResponseWithJson<SelectWithResponse>;
    res.json = json;
    return res;
  }

  stopAll() {
    this.tasks.forEach((task) => task.stop());
  }
}
