/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from "inversify";
import { MessageClient, MessageType, MessageOptions } from "./message-service-protocol";

export interface MessageArgs {
    message: string;
    options?: MessageOptions;
    actions?: string[];
}

@injectable()
export class MessageService {

    constructor(
        @inject(MessageClient) protected readonly client: MessageClient
    ) { }

    log(message: string, ...actions: string[]): Promise<string | undefined>;
    log(message: string, options?: MessageOptions): Promise<string | undefined>;
    log(message: string, options?: MessageOptions, ...actions: string[]): Promise<string | undefined>;
    log(message: string, ...args: any[]): Promise<string | undefined> {
        return this.processArgs(MessageType.Log, message, args);
    }

    info(message: string, ...actions: string[]): Promise<string | undefined>;
    info(message: string, options?: MessageOptions): Promise<string | undefined>;
    info(message: string, options?: MessageOptions, ...actions: string[]): Promise<string | undefined>;
    info(message: string, ...args: any[]): Promise<string | undefined> {
        return this.processArgs(MessageType.Info, message, args);
    }

    warn(message: string, ...actions: string[]): Promise<string | undefined>;
    warn(message: string, options?: MessageOptions): Promise<string | undefined>;
    warn(message: string, options?: MessageOptions, ...actions: string[]): Promise<string | undefined>;
    warn(message: string, ...args: any[]): Promise<string | undefined> {
        return this.processArgs(MessageType.Warning, message, args);
    }

    error(args: MessageArgs): Promise<string | undefined> {
        return this.client.showMessage({ type: MessageType.Error, options: args.options, text: args.message, actions: args.actions });
    }

    private processArgs(messageType: MessageType, messageText: string, args: any[]): Promise<string | undefined> {
        let timeoutvalue: number | undefined;
        let actionsValue: string[] | undefined;

        if (args && args.length > 0) {
            if (args[0]['timeout'] !== undefined) {
                timeoutvalue = args[0]['timeout'];
                if (args[1]) {
                    actionsValue = args.slice(1);
                }
            } else {
                actionsValue = args;
            }
            return this.client.showMessage({ type: messageType, options: { timeout: timeoutvalue }, text: messageText, actions: actionsValue });

        }
        return this.client.showMessage({ type: messageType, text: messageText });
    }

}
