const express = require('express');
const cors = require('cors');
const JSON = require('JSON');
const app = express();
const redis = require('redis');
const client = redis.createClient(6379, '58.180.90.33');
const port = 3000;
const async = require('async');

app.use(cors());
//app.options('*', cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

client.auth('delynet1234');
client.on('error', (err) => {
    console.log('redis error ' + err);
});

const resultok = '{"resultcode":"1a","resultdesc":"ok"}';

app.get('/', function (req, res) {
    return res.send('hello');
});
app.get('/SearchQueueCount', function (req, res) {
    //console.log(req.query.a)
    let servername = req.query.a;
    console.log(servername);
    if (servername == '') {
        return res.send('{"resultcode":"91","resultdesc":"empty parameter"}');
    }
    client.get(servername, function (err, val) {
        if (err) throw err;
        //console.log('result: ' + servername + '=' + val)
        return res.send(resultok);
    });
});

app.get('/UpdateQueueCount', function (req, res) {
    //console.log(req.query.a)
    const obj = JSON.parse(req.query.a);
    //console.log(obj)
    const servername = obj.servername;
    const count = obj.count;
    //console.log(servername + '=' + count)
    if (!servername) {
        return res.send('{"resultcode":"91","resultdesc":"empty parameter"}');
    }

    client.set(servername, count, function (err) {
        if (err) throw err;
        return res.send('done');
    });
});

app.get('/facredis/searchdata1', function (req, res) {
    const obj = JSON.parse(req.query.a);
    //console.log(obj.faxno);
    const faxno = obj.faxno;
    //console.log(servername + '=' + count)
    if (faxno == '') {
        return res.send('{"resultcode":"91","resultdesc":"empty parameter"}');
    }
    if (isNaN(faxno)) {
        return res.send(
            '{"resultcode":"91","resultdesc":"incorrect data(required only number)"}'
        );
    }

    client.get(faxno, function (err, val) {
        if (err) throw err;
        //console.log('result: ' + servername + '=' + val)
        if (!val) {
            return res.send(
                '{"resultcode":"91","resultdesc":"not found data"}'
            );
        } else {
            return res.send(resultok);
        }
    });
});

app.post('/facredis/adddata', function (req, res) {
    let obj = JSON.parse(req.body.a);
    const inkey = obj.key;
    const invalue = obj.value;
    let expiretime = obj.expiretime;

    if (!inkey || !invalue) {
        return res.send('empty parameter');
    }
    if (expiretime == 0) {
        client.set(faxno, key, function (err) {
            if (err) throw err;
            return res.send(resultok);
        });
    } else {
        client.setex(inkey, expiretime, invalue, function (err) {
            if (err) throw err;
            return res.send(resultok);
        });
    }
});

app.get('/facredis/deletedata', function (req, res) {
    const obj = JSON.parse(req.query.a);
    const faxno = obj.faxno;

    if (!faxno) {
        return res.send('{"resultcode":"91","resultdesc":"empty parameter"}');
    }

    client.del(faxno, function (err) {
        if (err) throw err;
        return res.send(resultok);
    });
});

app.get('/SearchAllKeys', function (req, res) {
    client.keys('*', function (err, val) {
        if (err) throw err;
        return res.send(val);
    });
});

app.get('/facredis/cleardata', function (req, res) {
    const key = res.query.a;
    client.flushall(function (err, val) {
        if (err) throw err;
        return res.send(resultok);
    });
});

app.get('/facredis/searchdata', function (req, res) {
    const obj = JSON.parse(req.query.a);
    const inkey = obj.key;
    var inlikeyn = obj.likeyn;
    //return res.send('{"resultcode":"91","resultdesc":"empty parameter"}');
    if (inlikeyn == 'n') {
        client.get(inkey, function (err, val) {
            if (err) throw err;
            //console.log('result: ' + servername + '=' + val)
            if (!val) {
                console.log(val);
                return res.send(
                    '{"resultcode":"91","resultdesc":"not found data"}'
                );
            } else {
                return res.send({
                    resultcode: '1a',
                    resultdesc: 'ok',
                    resultdata: val,
                });
            }
        });
    } else if (inlikeyn == 'y') {
        client.keys(inkey + '*', function (err, keys) {
            if (err) throw err;
            if (keys) {
                async.map(
                    keys,
                    function (key, callback) {
                        client.get(key, function (err, value) {
                            if (err) throw err;
                            var job = {};
                            job['key'] = key;
                            job['value'] = value;
                            callback(null, job);
                        });
                    },
                    function (err, results) {
                        if (err) throw err;
                        console.log(results.length);
                        if (results.length == '0') {
                            return res.send(
                                '{"resultcode":"91","resultdesc":"not found data"}'
                            );
                        } else {
                            return res.send({
                                resultcode: '1a',
                                resultdesc: 'ok',
                                resultdata: results,
                            });
                        }
                    }
                );
            }
        });
    } else {
        return res.send('{"resultcode":"91","resultdesc":"not found data"}');
    }

    /* client.keys(pattern, function (err, keys) {
        if (err) return console.log(err);
        var result = [];
        for (var i = 0, len = keys.length; i < len; i++) {
            console.log(keys[i]);
            result.push(keys[i]);
        }
        return res.send(JSON.stringify(result));
    }); */

    /* console.log(inkey + ' ' + pattern);
    const scanAll = async (pattern) => {
        const scan = util.promisify(client.scan).bind(client);
        const result = [];
        let cursor = '0';
        do {
            const reply = await scan(cursor, 'MATCH', pattern);
            cursor = reply[0];
            result.push(...reply[1]);
        } while (cursor !== '0');
        return result;
    }; */
    /* function scan(inpattern, callback) {
        client.scan(cursor, 'MATCH', pattern + '*', function (err, reply) {
            if (err) throw err;

            cursor = reply[0];
            result = reply[1];

            if (cursor === '0') {
                return console.log('end search' + result);
            } else {
                return scan();
            }
        });
    } */
});

app.listen(port, function () {
    console.log('server on ' + 'port' + port);
});

/* 
app.post('/test', function (req, res) {
    var a = req.query.a
    console.log('post')
    console.log('query =' + req.query.a)
    console.log(a)
    const obj = JSON.parse(a)
    console.log(obj.kddi50)
    
    client.hmset('count', {
        kddi51: obj.kddi51,
        test: '123',
    })
    res.send({ test: obj.kddi51, new: obj.test })
})
*/
/*
app.post('/test1', function (req, res, next) {
    req.accepts('application/json')
    var a = req.query.a
    console.log('a=' + a)
    console.log(JSON.stringify(a))
    const obj = JSON.parse(a)
    console.log('obj=' + obj)
    var key2 = Object.keys(obj)
    var value = Object.values(obj)
    var count = 'count2'
    console.log('key2=' + key2)

    console.log('value=' + value)
    client.set('test123', '45')
    res.end('done')
}) */

/* app.get('/test1', function (req, res) {
    var a = req.query.a
    var b = req.query
    console.log(a)
    console.log(b)
    var aa = string(a)
    console.log(aa)
    client.get(value, function (err, result) {
        console.log(value)
        console.log(result)
        if (err) throw err
        res.send(result)
    })
})

app.get('/test', function (req, res) {
    console.log(req.query.a)
    console.log(req.query)

    client.hget('count', 'kddi51', function (err, val) {
        if (err) throw err
        console.log('kddi51:' + val)
        res.send({ kddi51: val })
    })
}) */
