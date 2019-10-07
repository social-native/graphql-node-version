// import {createVersionConnectionWithFullNodes} from './version_connection';

export {
    default as versionConnectionDecorator, // createRevisionConnection
    createVersionConnectionWithFullNodes as createRevisionConnection
} from './version_connection';
export {default as versionRecorderDecorator} from './version_recorder';
export {default as createRevisionMigrations} from './migrations/generator';
export {default as decorate} from './lib/mobx/decorate';
export * from './types';
