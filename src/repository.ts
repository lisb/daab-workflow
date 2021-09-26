// Copyright (c) 2021 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { UserContext, UserSession, WorkflowContext } from './engine';

export class Repository {
  private readonly store = new Map<string, string>();

  private keyOfWorkflowContext(wc: { id: string }): string {
    return `workflowcontext.${wc.id}`;
  }

  private keyOfUserContext(uc: { id: string }): string {
    return `usercontext.${uc.id}`;
  }

  async saveWorkflowContext(wc: WorkflowContext) {
    this.store.set(this.keyOfWorkflowContext(wc), JSON.stringify(wc.state()));
  }

  async saveUserContext(uc: UserContext) {
    this.store.set(this.keyOfUserContext(uc), JSON.stringify(uc));
  }

  async destroy(wc: WorkflowContext) {
    this.store.delete(this.keyOfWorkflowContext(wc));
  }

  async findUserContextByUserId(id?: string): Promise<UserContext | undefined> {
    if (!id) {
      return undefined;
    }

    const raw = this.store.get(this.keyOfUserContext({ id }));
    if (raw) {
      return UserContext.restore(JSON.parse(raw));
    } else {
      return undefined;
    }
  }

  async findWorkflowContext(id?: string): Promise<WorkflowContext | undefined> {
    if (!id) {
      return undefined;
    }

    const raw = this.store.get(this.keyOfWorkflowContext({ id }));
    if (raw) {
      return WorkflowContext.restore(JSON.parse(raw), this);
    } else {
      return undefined;
    }
  }

  private keyOfUserSession(talkId: string, userId: string): string {
    return `usersession.${talkId}/${userId}`;
  }

  async findOrCreateUserSession(talkId: string, userId: string) {
    const saved = await this.findUserSession(talkId, userId);
    if (saved) {
      return saved;
    }
    const created = new UserSession(talkId, userId);
    await this.saveUserSession(created);
    return created;
  }

  async findUserSession(talkId: string, userId: string) {
    const raw = this.store.get(this.keyOfUserSession(talkId, userId));
    if (raw) {
      return UserSession.restore(JSON.parse(raw));
    }
    return undefined;
  }

  async saveUserSession(us: UserSession) {
    this.store.set(this.keyOfUserSession(us.talkId, us.userId), JSON.stringify(us));
  }
}
