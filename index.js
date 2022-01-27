const express = require('express');
const cors = require('cors');
const JSON = require('JSON');
const app = express();
const redis = require('redis');

const port = 3000;
const async = require('async');
const { logger } = require('./logger');

app.use(cors());
//app.options('*', cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

client.on('error', (err) => {
    console.log('redis error ' + err);
});
const resultok = '{"resultcode":"1a","resultdesc":"ok"}';

app.get('/', function (req, res) {
    logger.info('test');
    return res.send('hello');
});

app.post('/facredis/adddata', function (req, res) {
    var reqquery = req.query.a;

    if (!reqquery) {
        //데이터가 POSTMAN 전송시 body, vb6 전송시 query에 담겨서 오기에 구분처리
        var obj = JSON.parse(req.body.a);
        logger.info('adddata?a=' + req.body.a);
    } else {
        var obj = JSON.parse(req.query.a);
        logger.info('adddata?a=' + req.query.a);
    }

    let inkey = obj.key;
    let invalue = obj.value;
    let expiretime = obj.expiretime;

    if (!inkey || !invalue) {
        return res.send('empty parameter');
    }
    if (expiretime == '0') {
        //expiretime 값이 없을 시 데이터 무제한 저장
        client.set(inkey, invalue, function (err, val) {
            if (err) throw err;
            logger.info('redis adddata return value : ' + val);
            return res.send(resultok);
        });
    } else {
        client.setex(inkey, expiretime, invalue, function (err, val) {
            if (err) throw err;
            logger.info('redis adddata return value : ' + val);
            return res.send(resultok);
        });
    }
});

app.get('/facredis/deletedata', function (req, res) {
    const obj = JSON.parse(req.query.a);
    const inkey = obj.inkey;
    logger.info(req.query.a);
    if (!inkey) {
        return res.send('{"resultcode":"91","resultdesc":"empty parameter"}');
    }

    client.del(inkey, function (err) {
        if (err) throw err;
        return res.send(resultok);
    });
});

app.get('/facredis/cleardata', function (req, res) {
    const key = res.query.a;
    client.flushall(function (err, val) {
        if (err) throw err;
        logger.error(err);
        return res.send(resultok);
    });
});

app.get('/facredis/searchdata', function (req, res) {
    const obj = JSON.parse(req.query.a);
    const inkey = obj.key;
    var inlikeyn = obj.likeyn;
    logger.info('searchdata?a=' + req.query.a);
    //return res.send('{"resultcode":"91","resultdesc":"empty parameter"}');
    //단건조회
    if (inlikeyn == 'N' || inlikeyn == 'n') {
        client.get(inkey, function (err, val) {
            if (err) throw err;
            //console.log('result: ' + servername + '=' + val)
            if (!val) {
                console.log(val);
                return res.send({
                    resultcode: '91',
                    resultdesc: 'not found data',
                    resultdata: '',
                });
            } else {
                return res.send({
                    resultcode: '1a',
                    resultdesc: 'ok',
                    resultdata: val,
                });
            }
        });
        // LIKE 검색 (결과 데이터 여러개)
    } else if (inlikeyn == 'y' || inlikeyn == 'Y') {
        client.keys(inkey + '*', function (err, keys) {
            // LIKE 조회해서 모든 값 출력 (inkey = 조회할 때 입력하는 값, keys = inkey* 로 검색된 LIKE 검색 결과)
            if (err) throw err;
            if (keys) {
                async.map(
                    //async.map(조회된 모든키값, function(콜백), function(결과))
                    //like겁색으로 검색된 모든 키값들(keys)을 map합수(반복문), 콜백 함수를 이용해서
                    //key : value 1:1매칭하고 결과를 배열(results)로 반환
                    //async(비동기 함수->동기적 함수), .map 함수를 사용하여 위에서 출력된 key값과 value 1:1 매칭
                    keys,
                    function (key, callback) {
                        //value를 가져오기 위한 콜백함수, 조회된 key가 없을때까지 동작
                        var job = {}; // 결과를 담는 객체
                        client.get(key, function (err, value) {
                            // key값과 value 매칭
                            if (err) throw err;
                            job['key'] = key;
                            job['value'] = value;
                        });
                        client.ttl(key, function (err, ttl) {
                            // key값과 ttl (expiretime) 매칭
                            if (err) throw err;
                            job['expiretime'] = ttl;
                            callback(null, job);
                        });
                    },
                    function (err, results) {
                        //map과 callback 함수 통과한 결과값 JSON 배열로 리턴
                        if (err) throw err;
                        //console.log(results.length);
                        if (results.length == '0') {
                            return res.send({
                                resultcode: '91',
                                resultdesc: 'not found data',
                                resultdata: '',
                            });
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
        return res.send({
            resultcode: '91',
            resultdesc: 'not found data',
            resultdata: '',
        });
    }
});

app.listen(port, function () {
    console.log('server on ' + 'port' + port);
});
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

/*

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
