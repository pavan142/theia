/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from 'inversify';
import {
    MessageClient,
    MessageType,
    Message
} from '@theia/core/lib/common';
import { Notifications, NotificationAction } from './notifications';
import { NotificationPreferences } from "./notification-preferences";

@injectable()
export class NotificationsMessageClient extends MessageClient {

    protected notifications: Notifications = new Notifications();
    @inject(NotificationPreferences) protected preferences: NotificationPreferences;

    showMessage(message: Message): Promise<string | undefined> {
        return this.show(message);
    }

    protected show(message: Message): Promise<string | undefined> {
        return new Promise(resolve => {
            this.showToast(message, a => resolve(a));
        });
    }

    protected showToast(message: Message, onCloseFn: (action: string | undefined) => void): void {
        const icon = this.iconFor(message.type);
        const text = message.text;
        const actions = (message.actions || []).map(action => <NotificationAction>{
            label: action,
            fn: element => onCloseFn(action)
        });

        const timeout = (message.actions)
            ? undefined
            : (message.options !== undefined ? message.options.timeout : this.preferences['notification.timeout']);

        actions.push(<NotificationAction>{
            label: 'Close',
            fn: element => onCloseFn(undefined)
        });
        this.notifications.show({
            icon,
            text,
            actions,
            timeout
        });
    }

    protected iconFor(type: MessageType): string {
        if (type === MessageType.Error) {
            return 'error';
        }
        if (type === MessageType.Warning) {
            return 'warning';
        }
        return 'info';
    }
}
