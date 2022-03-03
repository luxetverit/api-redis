'use strict';

const express = require('express');
const cors = require('cors');
const JSON = require('JSON');
const app = express();
const redis = require('redis');
const redis_config = require('./redis-config.json');
const port = 3000;
const async = require('async');
const { logger } = require('./logger');
const client = redis.createClient(redis_config.port, redis_config.host);
const multi = client.multi();

const resultok = '{"resultcode":"1a","resultdesc":"ok","resultdata":[]}';

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

client.auth(redis_config.auth);
client.on('error', (err) => {
    console.log('redis error ' + err);
});

app.get('/', function (req, res) {
    logger.info('test root url');
    return res.send('hello');
});

app.post('/facredis/adddata', function (req, res) {
    var reqquery = req.query.a;

    if (!reqquery) {
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
        return res.send({
            resultcode: '9a',
            resultdesc: 'empty parameter',
            resultdata: '',
        });
    }

    if (expiretime == '0' || expiretime == '') {
        multi.set(inkey, invalue, 'NX');
    } else {
        multi.set(inkey, invalue, 'EX', expiretime, 'NX');
    }
    multi.exec(function (err, result) {
        if (err) {
            logger.info('redis adddata return value : FAIL(err : ' + err + ')');
            return res.send({
                resultcode: '91',
                resultdesc: 'err',
                resultdata: 'redis multi.set err',
            });
        }

        if (result == '') {
            logger.info('redis adddata return value : duplication key');
            client.keys(inkey, function (err, keys) {
                if (err) throw err;
                if (keys) {
                    async.map(
                        keys,
                        function (key, callback) {
                            var job = {};
                            client.get(key, function (err, value) {
                                // key값과 value 매칭
                                if (err) throw err;
                                job['key'] = key;
                                job['value'] = value;
                            });
                            client.ttl(key, function (err, ttl) {
                                if (err) throw err;
                                job['expiretime'] = ttl;
                                callback(null, job);
                            });
                        },
                        function (err, results) {
                            if (err) throw err;
                            // 중복 키 있음, insert  실패, 중복 key, value, ttl 리턴
                            return res.send({
                                resultcode: '9y',
                                resultdesc: 'ok',
                                resultdata: results,
                            });
                        }
                    );
                }
            });
        } else {
            //중복 키 없음 & insert 성공
            logger.info('redis adddata return value : ' + result);
            return res.send(resultok);
        }
    });
});

app.get('/facredis/deletedata', function (req, res) {
    const obj = JSON.parse(req.query.a);
    const inkey = obj.key;
    logger.info(req.query.a);
    if (!inkey) {
        return res.send({
            resultcode: '9a',
            resultdesc: 'empty parameter',
            resultdata: '',
        });
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

app.get('/facredis/searchdata', async function (req, res) {
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
                    resultcode: '9a',
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
        client.keys(inkey, function (err, keys) {
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
                        if (results.length == 0) {
                            return res.send({
                                resultcode: '9a',
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
        return res.send('invaild paramter');
    }
});

function getRedisData(inkey, callback) {
    client.keys(inkey, function (err, keys) {
        if (err) throw err;
        if (keys) {
            async.map(
                keys,
                function (key, callback) {
                    var job = {}; // 결과를 담는 객체
                    client.get(key, function (err, value) {
                        if (err) throw err;
                        job['key'] = key;
                        job['value'] = value;
                    });
                    client.ttl(key, function (err, ttl) {
                        if (err) throw err;
                        job['expiretime'] = ttl;
                        callback(null, job);
                    });
                },
                function (err, results) {
                    if (err) throw err;

                    callback(results);
                }
            );
        }
    });
}

app.listen(port, function () {
    console.log('server on ' + 'port' + port);
});
