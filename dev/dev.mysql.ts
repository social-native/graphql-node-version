import knex from 'knex';
import provider from './app_provider';

import {development as developmentConfig} from '../knexfile.mysql';
const knexClient = knex(developmentConfig);

provider(knexClient);
