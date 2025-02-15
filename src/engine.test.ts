import yaml from 'js-yaml';
import { Workflows } from './engine';
import type { Workflow } from './workflow';
import { Repository } from './repository';

describe('Workflows.validate', () => {
  const test = (input: string, isValid: boolean) => expect(Workflows.validate(yaml.load(input))).toEqual(isValid);
  const valid = (input: string) => test(input, true);
  const invalid = (input: string) => test(input, false);

  it('invalid', () => {
    invalid(`name: test`)
    invalid(`version: 1`)
    invalid(`steps: []`)
    invalid(`on: push`)

    invalid(`
      version: 1
      name: test
    `)
    invalid(`
      version: 1
      steps: []
    `)
    invalid(`
      name: test
      steps: []
    `)
  });

  it('valid', () => {
    valid(`
      version: 1
      name: test
      steps: []
    `)
    valid(`
      version: 1
      name: test
      steps: []
      on: push
    `)
  });
});

const brain = {} as any;
const direct = { api: { dataStore: { me: { id: { high: 1, low: 1 } } } } } as any;
const robot = { brain, direct } as any;
const user = { id: '1' } as any;

describe('WorkflowContext', () => {
  let workflows: Workflows;
  beforeAll(() => {
    const docs = new Map<string, Workflow>();
    docs.set('test', yaml.load(`
      version: 1
      name: test
      on:
        text: { match: trigger_text }
      steps:
        - id: step1
          action: daab:message:text
          with: { text: 何か入力してください }
        - action: daab:message:text
          with: { text: "ECHO >> {{ step1.response }}" }
    `) as Workflow)
    workflows = new Workflows(docs, new Repository());
  });

  it('handleText from workflow_dispatch', async () => {
    const context = workflows.createWorkflowContext('test')!;
    expect(context.isActive()).toBe(true);
    expect(context.state().stepIndex).toBe(0);

    const selectRes = { robot, message: { user }, json: { response: 0, options: ['test'] }, send: jest.fn() } as any;
    await context.startWokflow(selectRes);
    expect(selectRes.send).toHaveBeenCalledTimes(1);
    expect(selectRes.send).toHaveBeenCalledWith({ text: '何か入力してください' });

    expect(context.isActive()).toBe(true);
    expect(context.state().stepIndex).toBe(0);

    const textRes = { robot, message: { user, text: 'test' }, send: jest.fn() } as any;
    await context.handleText(textRes);
    expect(textRes.send).toHaveBeenCalledTimes(1);
    expect(textRes.send).toHaveBeenCalledWith({ text: 'ECHO >> test' });

    expect(context.isActive()).toBe(false);
    expect(context.state().stepIndex).toBe(0);
  });

  it('handleText from text events', async () => {
    const triggerRes = { robot, message: { user, text: 'trigger_text' }, send: jest.fn() } as any;
    const context = workflows.createWorkflowContextByEvent('text', triggerRes)!;
    await context.triggerWorkflow('text');
    expect(context.isActive()).toBe(true);
    expect(context.state().stepIndex).toBe(-1);

    await context.handleText(triggerRes);
    expect(triggerRes.send).toHaveBeenCalledTimes(1);
    expect(triggerRes.send).toHaveBeenCalledWith({ text: '何か入力してください' });

    expect(context.isActive()).toBe(true);
    expect(context.state().stepIndex).toBe(0);

    const textRes = { robot, message: { user, text: 'test' }, send: jest.fn() } as any;
    await context.handleText(textRes);
    expect(textRes.send).toHaveBeenCalledTimes(1);
    expect(textRes.send).toHaveBeenCalledWith({ text: 'ECHO >> test' });

    expect(context.isActive()).toBe(false);
    expect(context.state().stepIndex).toBe(0);
  });
});