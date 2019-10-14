import {DateTime} from 'luxon';

export const castDateToUTCSeconds = (date: string | Date): number => {
    if (isDate(date)) {
        return DateTime.fromJSDate(date, {zone: 'local'}).toSeconds();
    } else {
        throw new Error('Error casting date to UTC secs');
    }
};

export const isDate = (date?: Date | string): date is Date => {
    return date instanceof Date;
};

export const unixSecondsToSqlTimestamp = (unixSeconds: number) => {
    return DateTime.fromSeconds(unixSeconds)
        .toUTC()
        .toSQL({includeOffset: true, includeZone: true});
};
