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

type Decorator = MethodDecorator | PropertyDecorator | DecoratorArray | undefined;
type DecoratorArray = MethodDecorator[] | PropertyDecorator[];

function decorate<T>(
    thing: T,
    decorators: {
        [P in keyof T]?: Decorator;
    }
): T {
    process.env.NODE_ENV !== 'production' &&
        invariant(isPlainObject(decorators), 'Decorators should be a key value map');
    const target = (typeof thing === 'function' ? thing.prototype : thing) as Object;

    for (let prop in decorators) {
        let propertyDecorators: DecoratorArray;
        const extractedDecorators = decorators[prop];
        if (!isDecoratorArray(extractedDecorators)) {
            propertyDecorators = [extractedDecorators] as DecoratorArray;
        } else {
            propertyDecorators = extractedDecorators;
        }

        process.env.NODE_ENV !== 'production' &&
            invariant(
                propertyDecorators.every(decorator => typeof decorator === 'function'),
                `Decorate: expected a decorator function or array of decorator functions for '${prop}'`
            );

        const descriptor = Object.getOwnPropertyDescriptor(target, prop);
        if (!descriptor) {
            invariant(descriptor, 'Could not find descriptor on object');
            break;
        }

        const newDescriptor = [...propertyDecorators].reduce(
            (accDescriptor, decorator) =>
                decorator<typeof descriptor.value>(
                    target,
                    prop,
                    accDescriptor
                ) as TypedPropertyDescriptor<any>,
            descriptor
        );

        if (newDescriptor) {
            Object.defineProperty(target, prop, newDescriptor);
        }
    }
    return thing;
}

// tslint:enable

function isDecoratorArray(decorator: Decorator): decorator is DecoratorArray {
    return decorator !== undefined && Array.isArray(decorator);
}

export default decorate;
