// tslint:disable
/**
 * **************************************************************
 * https://github.com/mobxjs/mobx/blob/master/src/utils/utils.ts
 * **************************************************************
 */

export const OBFUSCATED_ERROR =
    'An invariant failed, however the error is obfuscated because this is an production build.';

export function invariant(check: false, message?: string | boolean): never;
export function invariant(check: true, message?: string | boolean): void;
export function invariant(check: any, message?: string | boolean): void;
export function invariant(check: boolean, message?: string | boolean) {
    if (!check) {
        throw new Error('[decorate] ' + (message || OBFUSCATED_ERROR));
    }
}

export function isPlainObject(value: any) {
    if (value === null || typeof value !== 'object') {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

/**
 * **************************************************************
 * https://github.com/mobxjs/mobx/blob/master/src/api/decorate.ts
 * **************************************************************
 */
export function decorate<T>(
    clazz: new (...args: any[]) => T,
    decorators: {
        [P in keyof T]?:
            | MethodDecorator
            | PropertyDecorator
            | Array<MethodDecorator>
            | Array<PropertyDecorator>;
    }
): void;
export function decorate<T>(
    object: T,
    decorators: {
        [P in keyof T]?:
            | MethodDecorator
            | PropertyDecorator
            | Array<MethodDecorator>
            | Array<PropertyDecorator>;
    }
): T;
export function decorate(thing: any, decorators: any) {
    process.env.NODE_ENV !== 'production' &&
        invariant(isPlainObject(decorators), 'Decorators should be a key value map');
    const target = typeof thing === 'function' ? thing.prototype : thing;
    for (let prop in decorators) {
        let propertyDecorators = decorators[prop];
        if (!Array.isArray(propertyDecorators)) {
            propertyDecorators = [propertyDecorators];
        }
        process.env.NODE_ENV !== 'production' &&
            invariant(
                propertyDecorators.every((decorator: any) => typeof decorator === 'function'),
                `Decorate: expected a decorator function or array of decorator functions for '${prop}'`
            );
        const descriptor = Object.getOwnPropertyDescriptor(target, prop);
        const newDescriptor = propertyDecorators.reduce(
            (accDescriptor: any, decorator: any) => decorator(target, prop, accDescriptor),
            descriptor
        );
        if (newDescriptor) Object.defineProperty(target, prop, newDescriptor);
    }
    return thing;
}

// tslint:enable

export default decorate;
