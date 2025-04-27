import yaml from 'js-yaml';
import { isTriggerFired, parseTrigger, isScheduleTrigger } from './triggers';

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

describe('isTriggerFired', () => {
  it('workflow_dispatch', () => {
    expect(isTriggerFired('workflow_dispatch', undefined)).toEqual(false);
    expect(isTriggerFired('workflow_dispatch', {})).toEqual(true);
  });

  it('text', () => {
    const res = { message: { text: 'trigger_text' } } as any;
    expect(isTriggerFired('text', { match: 'unmatched_text' }, res)).toEqual(false);
    expect(isTriggerFired('text', { match: 'trigger_text' }, res)).toEqual(true);
  });

  it('file', () => {
    const res = { json: { name: 'trigger_file', content_type: 'trigger_type' } } as any;
    expect(isTriggerFired('file', { name: 'unmatched_file' }, res)).toEqual(false);
    expect(isTriggerFired('file', { name: 'trigger_file' }, res)).toEqual(true);

    expect(isTriggerFired('file', { type: 'unmatched_type' }, res)).toEqual(false);
    expect(isTriggerFired('file', { type: 'trigger_type' }, res)).toEqual(true);

    // both conditions must match (AND condition)
    expect(isTriggerFired('file', { name: 'unmatched_file', type: 'unmatched_type' }, res)).toEqual(false);
    expect(isTriggerFired('file', { name: 'trigger_file', type: 'unmatched_type' }, res)).toEqual(false);
    expect(isTriggerFired('file', { name: 'unmatched_file', type: 'trigger_type' }, res)).toEqual(false);
    expect(isTriggerFired('file', { name: 'trigger_file', type: 'trigger_type' }, res)).toEqual(true);
  });

  it('files', () => {
    const res = { json: { files: [{ name: 'trigger_file', content_type: 'trigger_type' }] } } as any;
    expect(isTriggerFired('files', { name: 'unmatched_file' }, res)).toEqual(false);
    expect(isTriggerFired('files', { name: 'trigger_file' }, res)).toEqual(true);

    expect(isTriggerFired('files', { type: 'unmatched_type' }, res)).toEqual(false);
    expect(isTriggerFired('files', { type: 'trigger_type' }, res)).toEqual(true);

    // both conditions must match (AND condition)
    expect(isTriggerFired('files', { name: 'unmatched_file', type: 'unmatched_type' }, res)).toEqual(false);
    expect(isTriggerFired('files', { name: 'trigger_file', type: 'unmatched_type' }, res)).toEqual(false);
    expect(isTriggerFired('files', { name: 'unmatched_file', type: 'trigger_type' }, res)).toEqual(false);
    expect(isTriggerFired('files', { name: 'trigger_file', type: 'trigger_type' }, res)).toEqual(true);
  });

  it('select', () => {
    const res = { json: { question: 'trigger_question', response: 42 } } as any;
    expect(isTriggerFired('select', { question: { match: 'unmatched_question' } }, res)).toEqual(false);
    expect(isTriggerFired('select', { question: { match: 'trigger_question' } }, res)).toEqual(true);

    expect(isTriggerFired('select', { response: 0 }, res)).toEqual(false);
    expect(isTriggerFired('select', { response: 42 }, res)).toEqual(true);

    // both conditions must match (AND condition)
    expect(isTriggerFired('select', { response: 0, question: { match: 'unmatched_question' } }, res)).toEqual(false);
    expect(isTriggerFired('select', { response: 42, question: { match: 'unmatched_question' } }, res)).toEqual(false);
    expect(isTriggerFired('select', { response: 0, question: { match: 'trigger_question' } }, res)).toEqual(false);
    expect(isTriggerFired('select', { response: 42, question: { match: 'trigger_question' } }, res)).toEqual(true);
  });

  it('note_created', () => {
    const res = { json: { title: 'trigger_title' } } as any;
    expect(isTriggerFired('note_created', { title: 'unmatched_title' }, res)).toEqual(false);
    expect(isTriggerFired('note_created', { title: 'trigger_title' }, res)).toEqual(true);

    expect(isTriggerFired('note_created', { has_attachments: false }, res)).toEqual(true);
    expect(isTriggerFired('note_created', { has_attachments: true }, res)).toEqual(false);

    // both conditions must match (AND condition)
    expect(isTriggerFired('note_created', { title: 'unmatched_title', has_attachments: false }, res)).toEqual(false);
    expect(isTriggerFired('note_created', { title: 'unmatched_title', has_attachments: true }, res)).toEqual(false);
    expect(isTriggerFired('note_created', { title: 'trigger_title', has_attachments: false }, res)).toEqual(true);
    expect(isTriggerFired('note_created', { title: 'trigger_title', has_attachments: true }, res)).toEqual(false);
  });

  it('note_created.has_attachments', () => {
    const res = { json: { title: 'trigger_title', has_attachments: true } } as any;
    expect(isTriggerFired('note_created', { title: 'unmatched_title' }, res)).toEqual(false);
    expect(isTriggerFired('note_created', { title: 'trigger_title' }, res)).toEqual(true);

    expect(isTriggerFired('note_created', { has_attachments: false }, res)).toEqual(false);
    expect(isTriggerFired('note_created', { has_attachments: true }, res)).toEqual(true);

    // both conditions must match (AND condition)
    expect(isTriggerFired('note_created', { title: 'unmatched_title', has_attachments: false }, res)).toEqual(false);
    expect(isTriggerFired('note_created', { title: 'unmatched_title', has_attachments: true }, res)).toEqual(false);
    expect(isTriggerFired('note_created', { title: 'trigger_title', has_attachments: false }, res)).toEqual(false);
    expect(isTriggerFired('note_created', { title: 'trigger_title', has_attachments: true }, res)).toEqual(true);
  });

  it('note_updated', () => {
    const res = { json: { title: 'trigger_title' } } as any;
    expect(isTriggerFired('note_updated', { title: 'unmatched_title' }, res)).toEqual(false);
    expect(isTriggerFired('note_updated', { title: 'trigger_title' }, res)).toEqual(true);

    expect(isTriggerFired('note_updated', { has_attachments: false }, res)).toEqual(true);
    expect(isTriggerFired('note_updated', { has_attachments: true }, res)).toEqual(false);

    // both conditions must match (AND condition)
    expect(isTriggerFired('note_updated', { title: 'unmatched_title', has_attachments: false }, res)).toEqual(false);
    expect(isTriggerFired('note_updated', { title: 'unmatched_title', has_attachments: true }, res)).toEqual(false);
    expect(isTriggerFired('note_updated', { title: 'trigger_title', has_attachments: false }, res)).toEqual(true);
    expect(isTriggerFired('note_updated', { title: 'trigger_title', has_attachments: true }, res)).toEqual(false);
  });

  it('note_updated.has_attachments', () => {
    const res = { json: { title: 'trigger_title', has_attachments: true } } as any;
    expect(isTriggerFired('note_updated', { title: 'unmatched_title' }, res)).toEqual(false);
    expect(isTriggerFired('note_updated', { title: 'trigger_title' }, res)).toEqual(true);

    expect(isTriggerFired('note_updated', { has_attachments: false }, res)).toEqual(false);
    expect(isTriggerFired('note_updated', { has_attachments: true }, res)).toEqual(true);

    // both conditions must match (AND condition)
    expect(isTriggerFired('note_updated', { title: 'unmatched_title', has_attachments: false }, res)).toEqual(false);
    expect(isTriggerFired('note_updated', { title: 'unmatched_title', has_attachments: true }, res)).toEqual(false);
    expect(isTriggerFired('note_updated', { title: 'trigger_title', has_attachments: false }, res)).toEqual(false);
    expect(isTriggerFired('note_updated', { title: 'trigger_title', has_attachments: true }, res)).toEqual(true);
  });

  it('note_deleted', () => {
    const res = { json: { title: 'trigger_title' } } as any;
    expect(isTriggerFired('note_deleted', { title: 'unmatched_title' }, res)).toEqual(false);
    expect(isTriggerFired('note_deleted', { title: 'trigger_title' }, res)).toEqual(true);

    expect(isTriggerFired('note_deleted', { has_attachments: false }, res)).toEqual(true);
    expect(isTriggerFired('note_deleted', { has_attachments: true }, res)).toEqual(false);

    // both conditions must match (AND condition)
    expect(isTriggerFired('note_deleted', { title: 'unmatched_title', has_attachments: false }, res)).toEqual(false);
    expect(isTriggerFired('note_deleted', { title: 'unmatched_title', has_attachments: true }, res)).toEqual(false);
    expect(isTriggerFired('note_deleted', { title: 'trigger_title', has_attachments: false }, res)).toEqual(true);
    expect(isTriggerFired('note_deleted', { title: 'trigger_title', has_attachments: true }, res)).toEqual(false);
  });

  it('note_deleted.has_attachments', () => {
    const res = { json: { title: 'trigger_title', has_attachments: true } } as any;
    expect(isTriggerFired('note_deleted', { title: 'unmatched_title' }, res)).toEqual(false);
    expect(isTriggerFired('note_deleted', { title: 'trigger_title' }, res)).toEqual(true);

    expect(isTriggerFired('note_deleted', { has_attachments: false }, res)).toEqual(false);
    expect(isTriggerFired('note_deleted', { has_attachments: true }, res)).toEqual(true);

    // both conditions must match (AND condition)
    expect(isTriggerFired('note_deleted', { title: 'unmatched_title', has_attachments: false }, res)).toEqual(false);
    expect(isTriggerFired('note_deleted', { title: 'unmatched_title', has_attachments: true }, res)).toEqual(false);
    expect(isTriggerFired('note_deleted', { title: 'trigger_title', has_attachments: false }, res)).toEqual(false);
    expect(isTriggerFired('note_deleted', { title: 'trigger_title', has_attachments: true }, res)).toEqual(true);
  });

  it('common.roomType', () => {
    const unknown = { message: { roomType: 0 } } as any;
    expect(isTriggerFired('text', { roomType: 0 }, unknown)).toEqual(false);
    expect(isTriggerFired('text', { roomType: 1 }, unknown)).toEqual(false);
    expect(isTriggerFired('text', { roomType: 2 }, unknown)).toEqual(false);

    const pair = { message: { roomType: 1 } } as any;
    expect(isTriggerFired('text', { roomType: 0 }, pair)).toEqual(false);
    expect(isTriggerFired('text', { roomType: 1 }, pair)).toEqual(true);
    expect(isTriggerFired('text', { roomType: 2 }, pair)).toEqual(false);

    const group = { message: { roomType: 2 } } as any;
    expect(isTriggerFired('text', { roomType: 0 }, group)).toEqual(false);
    expect(isTriggerFired('text', { roomType: 1 }, group)).toEqual(false);
    expect(isTriggerFired('text', { roomType: 2 }, group)).toEqual(true);
  });
});

describe('isScheduleTrigger', () => {
  it('NG', () => {
    expect(isScheduleTrigger(undefined)).toEqual(false);
    expect(isScheduleTrigger({})).toEqual(false);
    expect(isScheduleTrigger({ schedule: [] })).toEqual(false);
    expect(isScheduleTrigger({ schedule: [{}] })).toEqual(false);
  });

  it('OK', () => {
    expect(isScheduleTrigger({ schedule: [{ cron: '0 0 * * *' }] })).toEqual(true);
  });
});
