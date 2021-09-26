// Copyright (c) 2021 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

export interface Workflow {
  version: `${number}.${number}.${number}`;
  name: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  name: string | undefined;
  id: string | undefined;
  action: string;
  with: unknown;
  exitFlow: boolean;
}

export const DefaultAction = {
  Text: 'daab:message:text',
  Select: 'daab:message:select',
  Yesno: 'daab:message:yesno',
  Todo: 'daab:message:todo',
} as const;
export type DefaultActionType = typeof DefaultAction[keyof typeof DefaultAction];

export function isDefaultAction(s: string): s is DefaultActionType {
  return !!s && Object.values(DefaultAction).some(a => a === s);
}

export type DefaultActionWith = DaabMessageTextWith | DaabMessageSelectWith;

interface DaabMessageTextWith {
  text: string;
  to: string | undefined;
}
interface DaabMessageSelectWith {
  text: string;
  options: string[];
  to: string | undefined;
}

export function isDaabMessageTextArgs(action: DefaultActionType, args: any): args is DaabMessageTextWith {
  return action == DefaultAction.Text;
}
export function isDaabMessageSelectArgs(action: DefaultActionType, args: any): args is DaabMessageSelectWith {
  return action == DefaultAction.Select;
}

// NOTE: これは受け取る側で使う型宣言の方法
export type WorkflowStepDefaultActionWith<A extends DefaultActionType> =
  A extends typeof DefaultAction.Text
    ? DaabMessageTextWith
    : A extends typeof DefaultAction.Select
    ? DaabMessageSelectWith
    : never;
