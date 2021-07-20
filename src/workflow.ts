// Copyright (c) 2021 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface Workflow {
  version: string;
  workflow: {
    name: string;
    steps: Step[];
  };
}

class Step {
  constructor(
    private readonly id: string,
    private readonly action: Action,
    public readonly exitFlow: boolean = false
  ) {}

  runAction(res: any) {}
}

interface Action {}

class MessageAction implements Action {}

export class WorkflowContext {}

function validate(wf: any): wf is Workflow {
  return typeof wf === 'object' && wf.version && wf.workflow && Array.isArray(wf.workflow.steps);
}

export class Workflows {
  constructor(private readonly docs: Map<string, Workflow>) {}

  static load(dirPath: string): Workflows {
    const filenames = fs
      .readdirSync(dirPath)
      .filter((e) => ['.yml', '.yaml'].includes(path.extname(e)))
      .map((e) => path.join(dirPath, e));

    const docs = new Map<string, Workflow>();
    filenames.forEach((fn) => {
      const o = yaml.load(fs.readFileSync(fn, 'utf8'));
      if (validate(o)) {
        docs.set(o.workflow.name, o);
      } else {
        throw new Error(`invalid workflow: ${fn}`);
      }
    });
    return new Workflows(docs);
  }

  get names(): string[] {
    return Array.from(this.docs.keys()).sort();
  }

  beginWorkflow(name: string): WorkflowContext {
    throw new Error('not implemented');
  }
}
