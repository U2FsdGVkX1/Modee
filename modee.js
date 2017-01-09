mysql = require('mysql');

class Modee {
    constructor(callback, options) {
        this.db = mysql.createConnection(options);
        this.db.connect(callback);
    }
    data_t(key, value) {
        var result = '';
        var value = this.value_quote(value);
        var valueMerge = value;
        var valueObject = typeof value == 'object';
        if(valueObject == true) {
            valueMerge = value.join(',');
        }

        if(key == 'LIMIT') {
            result = 'LIMIT ' + valueMerge;
        } else {
            var flag = key.match(/(\w+)(\[(.{1,2})\])?/);
            key = this.column_quote(flag[1]);
            flag = flag[3];
            switch(flag) {
                case '>':
                    result = key + ' > ' + valueMerge;
                    break;
                case '<':
                    result = key + ' < ' + valueMerge;
                    break;
                case '>=':
                    result = key + ' >= ' + valueMerge;
                    break;
                case '<=':
                    result = key + ' <= ' + valueMerge;
                    break;
                case '!':
                    if(valueObject == true) {
                        result = key + ' NOT IN (' + valueMerge + ')';
                    } else {
                        result = key + ' != ' + valueMerge;
                    }
                    break;
                case '<>':
                    result = key + ' BETWEEN ' + value[0] + ' AND ' + value[1];
                    break;
                case '><':
                    result = key + ' NOT BETWEEN ' + value[0] + ' AND ' + value[1];
                    break;
                case '+':
                    result = key + ' = ' + key + ' + ' + valueMerge;
                    break;
                case '-':
                    result = key + ' = ' + key + ' - ' + valueMerge;
                    break;
                case '*':
                    result = key + ' = ' + key + ' * ' + valueMerge;
                    break;
                case '/':
                    result = key + ' = ' + key + ' / ' + valueMerge;
                    break;
                case undefined:
                    if(valueObject == true) {
                        result = key + ' IN (' + valueMerge + ')';
                    } else {
                        result = key + ' = ' + valueMerge;
                    }
                    break;
            }
        }

        return result;
    }
    where_t(where, operator = ' ') {
        var result = [];
        if(operator == ' ') {
            var wherePush = false;
            for(var key in where) {
                if(
                    key != 'LIMIT'
                ) {
                    wherePush = true;
                    break;
                }
            }
            if(wherePush == true) {
                result.push('WHERE');
            }
        }

        for(var key in where) {
            if(key == 'AND' || key == 'OR') {
                result.push('(' + this.where_t(where[key], ' ' + key + ' ') + ')');
            } else {
                result.push(this.data_t(key, where[key]));
            }
        }

        return result.join(operator);
    }
    column_quote(column) {
        var result = [];
        switch(typeof column) {
            case 'string':
                result = '`' + column + '`';
                break;
            case 'object':
                for(var index in column) {
                    result[index] = this.column_quote(column[index]);
                }
                break;
        }

        return result;
    }
    value_quote(value) {
        var result = [];
        switch(typeof value) {
            case 'number':
                result = value;
                break;
            case 'string':
                // 参考无名智者的云签
                result = "'" + value.replace('\\', '\\\\').replace("'", "\\\'") + "'";
                break;
            case 'boolean':
                result = value == true ? 1 : 0
                break;
            case 'object':
                for(var index in value) {
                    result[index] = this.value_quote(value[index]);
                }
                break;
            case null:
                result = 'NULL';
                break;
        }

        return result;
    }
    query(callback, sql) {
        this.db.query(sql, callback);
        return {
            sql: sql
        };
    }
    select(callback, table, column = '*', where = []) {
        if(column != '*') {
            column = this.column_quote(column);
            if(typeof column == 'object') {
                column = column.join(',');
            }
        }

        var sql = 'SELECT ' + column + ' FROM ' + this.column_quote(table) + ' ' + this.where_t(where);
        return this.query(callback, sql);
    }
    insert(callback, table, data) {
        if(typeof data[0] == 'undefined') {
            data = [data];
        }

        var dataPush = [];
        for(var index in data) {
            dataPush.push('(' + this.value_quote(Object.values(data[index])) + ')');
        }

        var sql = 'INSERT INTO ' + this.column_quote(table) + '(' + this.column_quote(Object.keys(data[0])) + ') VALUES ' + dataPush.join(',');
        return this.query(callback, sql);
    }
    update(callback, table, data, where = []) {
        var dataPush = [];
        for(var key in data) {
            dataPush.push(this.data_t(key, data[key]));
        }

        var sql = 'UPDATE ' + this.column_quote(table) + ' SET ' + dataPush.join(',') + ' ' + this.where_t (where);
        return this.query(callback, sql);
    }
    delete(callback, table, where) {
        var sql = 'DELETE FROM ' + this.column_quote(table) + ' ' + this.where_t (where);
        return this.query(callback, sql);
    }
    get(callback, table, column = '*', where = []) {
        if(column != '*') {
            var columnNQ = column; 
            var columnObject = typeof column == 'object';

            column = this.column_quote(column);
            if(columnObject == true) {
                column = column.join(',');
            }
        }

        where['LIMIT'] = 1;
        var sql = 'SELECT ' + column + ' FROM ' + this.column_quote(table) + ' ' + this.where_t(where);
        return this.query(function(err, rows, fields) {
            if(err) {
                callback(err, rows, fields);
            } else {
                if(columnObject == false) {
                    callback(err, rows[0][columnNQ], fields);
                } else {
                    callback(err, rows[0], fields);
                }
            }
        }, sql);
    }
    has(callback, table, where) {
        var sql = 'SELECT NULL FROM ' + this.column_quote(table) + ' ' + this.where_t(where);
        sql = 'SELECT EXISTS(' + sql + ') AS ' + this.column_quote('result');
        return this.query(function(err, rows, fields) {
            if(err) {
                callback(err, rows, fields);
            } else {
                callback(err, rows[0]['result'] == 1, fields);
            }
        }, sql);
    }
    count(callback, table, where = []) {
        var sql = 'SELECT COUNT(*) FROM ' + this.column_quote(table) + ' ' + this.where_t(where);
        sql = 'SELECT (' + sql + ') AS ' + this.column_quote('result');
        return this.query(function(err, rows, fields) {
            if(err) {
                callback(err, rows, fields);
            } else {
                callback(err, rows[0]['result'], fields);
            }
        }, sql);
    }
    max(callback, table, column, where = []) {
        var sql = 'SELECT MAX(' + this.column_quote(column) + ') FROM ' + this.column_quote(table) + ' ' + this.where_t(where);
        sql = 'SELECT (' + sql + ') AS ' + this.column_quote('result');
        return this.query(function(err, rows, fields) {
            if(err) {
                callback(err, rows, fields);
            } else {
                callback(err, rows[0]['result'], fields);
            }
        }, sql);
    }
    min(callback, table, column, where = []) {
        var sql = 'SELECT MIN(' + this.column_quote(column) + ') FROM ' + this.column_quote(table) + ' ' + this.where_t(where);
        sql = 'SELECT (' + sql + ') AS ' + this.column_quote('result');
        return this.query(function(err, rows, fields) {
            if(err) {
                callback(err, rows, fields);
            } else {
                callback(err, rows[0]['result'], fields);
            }
        }, sql);
    }
    avg(callback, table, column, where = []) {
        var sql = 'SELECT AVG(' + this.column_quote(column) + ') FROM ' + this.column_quote(table) + ' ' + this.where_t(where);
        sql = 'SELECT (' + sql + ') AS ' + this.column_quote('result');
        return this.query(function(err, rows, fields) {
            if(err) {
                callback(err, rows, fields);
            } else {
                callback(err, rows[0]['result'], fields);
            }
        }, sql);
    }
    sum(callback, table, column, where = []) {
        var sql = 'SELECT SUM(' + this.column_quote(column) + ') FROM ' + this.column_quote(table) + ' ' + this.where_t(where);
        sql = 'SELECT (' + sql + ') AS ' + this.column_quote('result');
        return this.query(function(err, rows, fields) {
            if(err) {
                callback(err, rows, fields);
            } else {
                callback(err, rows[0]['result'], fields);
            }
        }, sql);
    }
}
module.exports = Modee;