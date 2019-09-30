import knex from 'knex';
import provider from './app_provider';

import {development as developmentConfig} from '../knexfile.sqlite';
const knexClient = knex(developmentConfig);

provider(knexClient);
