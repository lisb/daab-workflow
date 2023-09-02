import {
  WorkflowEvent,
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

