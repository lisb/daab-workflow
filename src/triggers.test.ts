import yaml from 'js-yaml';
import { parseTrigger } from './triggers';

describe('parseTrigger', () => {
  const parse = (input: string) => parseTrigger((yaml.load(input) as any).on)

  it('undefined', () => {
    expect(parse(`name:`)).toEqual({ workflow_dispatch: {} });
  });

  it('null', () => {
    expect(parse(`on:`)).toEqual({ workflow_dispatch: {} });
  });

  it('true', () => {
    expect(parse(`on: true`)).toEqual({ workflow_dispatch: {} });
  });

  it('string', () => {
    expect(parse('on: push')).toEqual({ push: {} });
  });

  it('array', () => {
    expect(parse(`on: [push, pull_request]`)).toEqual({ push: {}, pull_request: {} });
  });

  it('object', () => {
    expect(parse(`
      on:
        push: true
    `)).toEqual({ push: {} });
  });

  it('valid arguments', () => {
    expect(parse(`
      on:
        push:
          branches: [main]
    `)).toEqual({ push: { branches: ['main'] } });
  });

  it('invalid arguments', () => {
    expect(parse(`
      on:
        push: invalid
    `)).toEqual({});
  });
});