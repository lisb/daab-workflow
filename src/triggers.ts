import type { TextMessage } from 'lisb-hubot';
import type {
  NoteCreated,
  NoteDeleted,
  NoteUpdated,
  RemoteFile,
  RemoteFiles,
  Response,
  ResponseWithJson,
  SelectWithResponse,
} from 'hubot-direct';
import {
  WorkflowEvent,
  WorkflowEventType,
  WorkflowEventWith,
  WorkflowTrigger,
  WorkflowTriggerMap,
} from './workflow';

export function parseTrigger(on: any): WorkflowTriggerMap {
  if (Array.isArray(on)) {
    return on.reduce((obj, o) => ({ ...obj, ...parseTrigger(o) }), {});
  } else if (typeof on === 'object') {
    Object.keys(on).forEach((k) => {
      if (on[k] === null || on[k] === true) {
        on[k] = {}; // fix to {}
      } else if (typeof on[k] !== 'object') {
        delete on[k]; // invalid
      }
    });
    return on;
  } else if (typeof on === 'string') {
    return { [on]: {} };
  } else if (on === undefined) {
    return { [WorkflowEvent.WorkflowDispatch]: {} }; // default
  } else {
    return {}; // error
  }
}

export function isTriggerFired(
  type: WorkflowEventType,
  trigger: WorkflowTrigger | undefined,
  e: WorkflowEventWith | undefined
): boolean {
  if (!trigger) {
    return false;
  }
  if (Object.keys(trigger).length == 0) {
    return true;
  }
  switch (type) {
    case 'text': {
      const res = e as Response<TextMessage>;
      if (typeof trigger.match === 'string' && res.message.text.match(trigger.match)) {
        return true;
      }
      break;
    }
    case 'file': {
      const res = e as ResponseWithJson<RemoteFile>;
      if (typeof trigger.name === 'string' && res.json.name.match(trigger.name)) {
        return true;
      }
      if (typeof trigger.type === 'string' && res.json.content_type.match(trigger.type)) {
        return true;
      }
      break;
    }
    case 'files': {
      const res = e as ResponseWithJson<RemoteFiles>;
      if (
        typeof trigger.name === 'string' &&
        res.json.files.every((file) => file.name.match(trigger.name))
      ) {
        return true;
      }
      if (
        typeof trigger.type === 'string' &&
        res.json.files.every((file) => file.content_type.match(trigger.type))
      ) {
        return true;
      }
      break;
    }
    case 'select': {
      const res = e as ResponseWithJson<SelectWithResponse>;
      if (
        typeof trigger.question?.match === 'string' &&
        res.json.question.match(trigger.question.match)
      ) {
        return true;
      }
      if (typeof trigger.response === 'number' && res.json.response === trigger.response) {
        return true;
      }
      if (
        typeof trigger.response?.match === 'string' &&
        typeof res.json.response === 'number' &&
        res.json.options[res.json.response].match(trigger.response.match)
      ) {
        return true;
      }
      break;
    }
    case 'note_created':
    case 'note_updated':
    case 'note_deleted': {
      const res = e as ResponseWithJson<NoteCreated>;
      const note = res.json;
      if (typeof trigger.title === 'string' && note.title.match(trigger.title)) {
        return true;
      }
      if (
        typeof trigger.has_attachments === 'boolean' &&
        trigger.has_attachments == note.has_attachments
      ) {
        return true;
      }
      break;
    }
    default:
      break;
  }
  return false;
}
