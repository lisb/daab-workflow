import yaml from 'js-yaml';
import { Workflows } from './engine';

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
