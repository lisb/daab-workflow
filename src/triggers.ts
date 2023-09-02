import {
  Response,
  TextMessage,
} from 'lisb-hubot';
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
    default:
      break;
  }
  return false;
}
