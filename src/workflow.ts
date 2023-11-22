// Copyright (c) 2021 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

export interface Workflow {
  version: `${number}.${number}.${number}`;
  name: string;
  steps: WorkflowStep[];
  on: WorkflowTriggerMap;
}

export interface WorkflowStep {
  name: string | undefined;
  id: string | undefined;
  if: boolean | undefined;
  action: string;
  with: unknown;
  nowait: boolean | undefined;
  exitFlow: boolean | undefined;
}

export const WorkflowEvent = {
  WorkflowDispatch: 'workflow_dispatch',
  Text: 'text',
  Select: 'select',
  YesNo: 'yesno',
  Task: 'task',
  Join: 'join',
  Leave: 'leave',
  NoteCreated: 'note_created',
  NoteUpdated: 'note_updated',
  NoteDeleted: 'note_deleted',
} as const;
export type WorkflowEventType = (typeof WorkflowEvent)[keyof typeof WorkflowEvent];

export type WorkflowTrigger = Record<string, any>;

export type WorkflowTriggerMap = Partial<{ [e in WorkflowEventType]: WorkflowTrigger }>;

export type WorkflowEventWith = Record<string, any>;

export const DefaultAction = {
  Text: 'daab:message:text',
  Select: 'daab:message:select',
  YesNo: 'daab:message:yesno',
  Task: 'daab:message:task',
  Note: 'daab:message:note',
} as const;
export type DefaultActionType = typeof DefaultAction[keyof typeof DefaultAction];

export function isDefaultAction(s: string): s is DefaultActionType {
  return !!s && Object.values(DefaultAction).some((a) => a === s);
}

export function isCustomAction(s: string): boolean {
  return !!s && s.startsWith('custom:');
}

export function getCustomActionName(s: string): string {
  return s.substring('custom:'.length);
}

export type DefaultActionWith =
  | DaabMessageTextWith
  | DaabMessageSelectWith
  | DaabMessageYesNoWith
  | DaabMessageTaskWith;

interface DaabMessageTextWith {
  text: string;
  to: string | undefined;
}

interface DaabMessageSelectWith {
  question: string;
  options: string[];
  to: string | undefined;
}

interface DaabMessageYesNoWith {
  question: string;
  to: string | undefined;
}

interface DaabMessageTaskWith {
  title: string;
  to: string | undefined;
}

export function isDaabMessageTextArgs(
  action: DefaultActionType,
  args: any
): args is DaabMessageTextWith {
  return action == DefaultAction.Text;
}

export function isDaabMessageSelectArgs(
  action: DefaultActionType,
  args: any
): args is DaabMessageSelectWith {
  return action == DefaultAction.Select;
}

export function isDaabMessageYesNoArgs(
  action: DefaultActionType,
  args: any
): args is DaabMessageYesNoWith {
  return action == DefaultAction.YesNo;
}

export function isDaabMessageTaskArgs(
  action: DefaultActionType,
  args: any
): args is DaabMessageTaskWith {
  return action == DefaultAction.Task;
}

// NOTE: これは受け取る側で使う型宣言の方法
export type WorkflowStepDefaultActionWith<A extends DefaultActionType> =
  A extends typeof DefaultAction.Text
    ? DaabMessageTextWith
    : A extends typeof DefaultAction.Select
    ? DaabMessageSelectWith
    : never;
