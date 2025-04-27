import type { Message, TextMessage } from 'lisb-hubot';
import type {
  JsonContent,
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
  WorkflowTrigger,
  WorkflowTriggerMap,
} from './workflow';

export function parseTrigger(on: any): WorkflowTriggerMap {
  if (on === undefined || on === null || on === true) {
    return { [WorkflowEvent.WorkflowDispatch]: {} }; // default
  } else if (Array.isArray(on)) {
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
  } else {
    throw new Error("Invalid 'on' value");
  }
}

export function isTriggerFired(
  type: WorkflowEventType,
  trigger: WorkflowTrigger | undefined,
  e?: Response<Message> | ResponseWithJson<JsonContent>,
): boolean {
  if (!trigger) {
    return false;
  }
  if (Object.keys(trigger).length == 0) {
    return true;
  }
  let ok = true;
  if (typeof trigger.roomType == 'number' && typeof e?.message.roomType == 'number') {
    ok = ok && trigger.roomType > 0 && e.message.roomType > 0 && trigger.roomType === e.message.roomType;
  }
  switch (type) {
    case 'text': {
      const res = e as Response<TextMessage>;
      // TODO: ペアトークのメッセージに Hubot が入ってくる。メンションの扱い。実用的には本文にマッチさせたい。
      if (typeof trigger.match === 'string') {
        ok = ok && !!res.message.text.replace(/^Hubot /i, '').replace(/^@.*\sさん\s/, '').match(trigger.match)
      }
      break;
    }
    case 'file': {
      const res = e as ResponseWithJson<RemoteFile>;
      if (typeof trigger.name === 'string') {
        ok = ok && !!res.json.name.match(trigger.name);
      }
      if (typeof trigger.type === 'string') {
        ok = ok && !!res.json.content_type.match(trigger.type);
      }
      break;
    }
    case 'files': {
      const res = e as ResponseWithJson<RemoteFiles>;
      if (typeof trigger.name === 'string') {
        ok = ok && res.json.files.every((file) => file.name.match(trigger.name));
      }
      if (typeof trigger.type === 'string') {
        ok = ok && res.json.files.every((file) => file.content_type.match(trigger.type));
      }
      break;
    }
    case 'select': {
      const res = e as ResponseWithJson<SelectWithResponse>;
      if (typeof trigger.question?.match === 'string') {
        ok = ok && !!res.json.question.match(trigger.question.match);
      }
      if (typeof trigger.response === 'number') {
        ok = ok && res.json.response === trigger.response;
      }
      if (
        typeof trigger.response?.match === 'string' &&
        typeof res.json.response === 'number'
      ) {
        ok = ok && !!res.json.options[res.json.response].match(trigger.response.match);
      }
      break;
    }
    case 'note_created':
    case 'note_updated':
    case 'note_deleted': {
      const res = e as ResponseWithJson<NoteCreated>;
      const note = res.json;
      if (typeof trigger.title === 'string') {
        ok = ok && !!note.title.match(trigger.title);
      }
      if (typeof trigger.has_attachments === 'boolean') {
        ok = ok && trigger.has_attachments == !!note.has_attachments;
      }
      break;
    }
    default:
      ok = false;
      break;
  }
  return ok;
}

export function isScheduleTrigger(trigger: WorkflowTrigger | undefined) {
  return Array.isArray(trigger?.schedule) && trigger!.schedule.some((s) => s.cron);
}
