import knex from 'knex';

import {development as developmentConfig} from '../knexfile.mysql';
import {
    decorate,
    versionRecorderDecorator as versionRecorder,
    versionConnectionDecorator as versionConnection,
    IRevisionConnection,
    INodeBuilderRevisionInfo
} from '../src/index';
const knexClient = knex(developmentConfig);




