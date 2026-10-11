// ==UserScript==
// @name         洛谷首页自定义 Banner + Bilibili 单视频/合集断点续播 V40
// @namespace    https://www.luogu.com.cn/
// @version      40.0
// @description  洛谷首页自定义 Banner，支持 Bilibili 普通视频/合集自动播放、断点续播
// @match        https://www.luogu.com.cn/
// @match        https://www.luogu.com.cn/*
// @match        https://player.bilibili.com/player.html*
// @grant        GM_xmlhttpRequest
// @connect      api.bilibili.com
// @connect      www.bilibili.com
// @connect      bilibili.com
// ==/UserScript==

(function () {

    'use strict';


    /************************************************************
     * Bilibili iframe 部分
     ************************************************************/

    if (
        location.hostname === 'player.bilibili.com' &&
        location.pathname === '/player.html'
    ) {

        console.log(
            '[洛谷 Banner V40] Bilibili iframe 监听器启动'
        );


        const hookedVideos =
            new WeakSet();


        let pendingResumeTime = null;


        /*
         * 给 video 设置断点。
         */

        function applyResume(video) {

            if (
                pendingResumeTime === null ||
                pendingResumeTime <= 0
            ) {
                return;
            }


            const duration =
                Number(video.duration);


            if (
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                return;
            }


            let t =
                pendingResumeTime;


            pendingResumeTime = null;


            /*
             * 如果已经接近视频结尾，
             * 不要卡在最后一秒。
             */

            if (
                t >= duration - 2
            ) {

                t = 0;

            } else {

                t =
                    Math.min(
                        t,
                        duration - 1
                    );

            }


            try {

                video.currentTime = t;


                console.log(
                    '[洛谷 Banner V40] 已恢复到',
                    Math.floor(t),
                    '秒'
                );


                window.parent.postMessage(
                    {
                        type:
                            'luogu-bilibili-resumed',

                        currentTime:
                            t

                    },
                    '*'
                );

            } catch (e) {

                /*
                 * 如果此时 video 仍然不能 seek，
                 * 再把时间放回去，等待下一次 canplay。
                 */

                pendingResumeTime = t;

            }

        }


        /********************************************************
         * 父页面 -> iframe
         ********************************************************/

        window.addEventListener(
            'message',
            event => {

                /*
                 * 只接受洛谷页面。
                 */

                if (
                    event.origin !==
                    'https://www.luogu.com.cn'
                ) {
                    return;
                }


                const data =
                    event.data;


                if (
                    !data ||
                    typeof data !== 'object'
                ) {
                    return;
                }


                if (
                    data.type !==
                    'luogu-bilibili-resume'
                ) {
                    return;
                }


                pendingResumeTime =
                    Number(
                        data.currentTime
                    ) || 0;


                console.log(
                    '[洛谷 Banner V40] 收到恢复时间：',
                    Math.floor(
                        pendingResumeTime
                    ),
                    '秒'
                );


                const video =
                    document.querySelector(
                        'video'
                    );


                if (video) {

                    applyResume(
                        video
                    );

                }

            }
        );


        /********************************************************
         * 监听 video
         ********************************************************/

        function hookVideo() {

            const videos =
                document.querySelectorAll(
                    'video'
                );


            if (!videos.length) {
                return;
            }


            videos.forEach(
                video => {

                    /*
                     * 已经监听过的 video。
                     */

                    if (
                        hookedVideos.has(
                            video
                        )
                    ) {

                        /*
                         * 如果之前还有断点没设置，
                         * 再尝试一次。
                         */

                        applyResume(
                            video
                        );

                        return;

                    }


                    hookedVideos.add(
                        video
                    );


                    console.log(
                        '[洛谷 Banner V40] 找到 video'
                    );


                    /********************************************
                     * 恢复断点
                     ********************************************/

                    video.addEventListener(
                        'loadedmetadata',
                        () => {

                            applyResume(
                                video
                            );

                        }
                    );


                    video.addEventListener(
                        'durationchange',
                        () => {

                            applyResume(
                                video
                            );

                        }
                    );


                    video.addEventListener(
                        'canplay',
                        () => {

                            applyResume(
                                video
                            );

                        }
                    );


                    video.addEventListener(
                        'loadeddata',
                        () => {

                            applyResume(
                                video
                            );

                        }
                    );


                    /********************************************
                     * 告诉父页面：
                     * video 已经找到
                     ********************************************/

                    window.parent.postMessage(
                        {
                            type:
                                'luogu-bilibili-ready'
                        },
                        '*'
                    );


                    /********************************************
                     * 播放结束
                     ********************************************/

                    video.addEventListener(
                        'ended',
                        () => {

                            console.log(
                                '[洛谷 Banner V40] video ended'
                            );


                            window.parent.postMessage(
                                {
                                    type:
                                        'luogu-bilibili-ended'
                                },
                                '*'
                            );

                        }
                    );


                    /********************************************
                     * 播放进度
                     ********************************************/

                    let lastReport = 0;


                    function reportProgress(
                        force = false
                    ) {

                        const now =
                            Date.now();


                        if (
                            !force &&
                            now - lastReport < 1800
                        ) {
                            return;
                        }


                        lastReport =
                            now;


                        if (
                            !Number.isFinite(
                                video.currentTime
                            )
                        ) {
                            return;
                        }


                        window.parent.postMessage(
                            {
                                type:
                                    'luogu-bilibili-progress',

                                currentTime:
                                    video.currentTime,

                                duration:
                                    video.duration,

                                force

                            },
                            '*'
                        );

                    }


                    /*
                     * 正常播放。
                     */

                    video.addEventListener(
                        'timeupdate',
                        () => {

                            reportProgress(
                                false
                            );

                        }
                    );


                    /*
                     * 暂停时强制保存。
                     */

                    video.addEventListener(
                        'pause',
                        () => {

                            reportProgress(
                                true
                            );

                        }
                    );


                    /*
                     * ended 前再保存一次。
                     */

                    video.addEventListener(
                        'ended',
                        () => {

                            reportProgress(
                                true
                            );

                        }
                    );


                    /*
                     * 定时保存。
                     */

                    const progressTimer =
                        setInterval(
                            () => {

                                /*
                                 * video 被移除后，
                                 * 不再继续报告。
                                 */

                                if (
                                    !document.contains(
                                        video
                                    )
                                ) {

                                    clearInterval(
                                        progressTimer
                                    );

                                    return;

                                }


                                reportProgress(
                                    false
                                );

                            },
                            2000
                        );

                }
            );

        }


        hookVideo();


        /*
         * Bilibili 播放器内部 video
         * 有可能动态替换，所以持续检查。
         */

        const observer =
            new MutationObserver(
                () => {

                    hookVideo();

                }
            );


        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );


        setInterval(
            hookVideo,
            500
        );


        return;

    }


    /************************************************************
     * 洛谷页面
     ************************************************************/


    /************************************************************
     * 图片
     ************************************************************/

    const images = [

        'https://cdn.luogu.com.cn/upload/image_hosting/pc1hycbr.webp',

        'https://cdn.luogu.com.cn/upload/image_hosting/w3gw3vgj.webp',

        'https://cdn.luogu.com.cn/upload/image_hosting/20xzdj9e.webp',

        'https://cdn.luogu.com.cn/upload/image_hosting/a54oyxz4.webp'

    ];


    /************************************************************
     * Bilibili 入口 BV
     ************************************************************/

    const BILIBILI_ENTRY_BVID =
        'BV1DYPQzxEt7';


    /************************************************************
     * 断点 Key
     ************************************************************/

    const PROGRESS_KEY =
        'luogu_banner_bilibili_progress_v40';


    /*
     * V39 的存档。
     *
     * 升级 V40 时自动迁移。
     */

    const LEGACY_PROGRESS_KEY =
        'luogu_banner_bilibili_progress_v39';


    /************************************************************
     * Banner 设置
     ************************************************************/

    const IMAGE_DURATION =
        5000;


    const BANNER_RATIO =
        '427 / 166';


    /************************************************************
     * 状态
     ************************************************************/

    let root = null;


    let currentIndex = 0;


    let playlist = [];


    let playlistIndex = 0;


    let collectionLoaded = false;


    let isCollection = false;


    let loadingCollection = false;


    let timer = null;


    let videoGeneration = 0;


    let videoEnded = false;


    let resumeTime = 0;


    let currentPlayingBvid = null;


    /*
     * 当前 Bilibili iframe。
     */

    let currentIframe = null;


    /*
     * 当前 iframe 的 message 监听器。
     */

    let currentMessageHandler = null;


    /************************************************************
     * 日志
     ************************************************************/

    function log(...args) {

        console.log(
            '[洛谷 Banner V40]',
            ...args
        );

    }


    function error(...args) {

        console.error(
            '[洛谷 Banner V40]',
            ...args
        );

    }


    function sleep(ms) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );

    }


    /************************************************************
     * 进度保存
     ************************************************************/

    function saveProgress(
        bvid = currentPlayingBvid,
        currentTime = resumeTime,
        duration = 0
    ) {

        if (!bvid) {
            return;
        }


        const time =
            Number(
                currentTime
            );


        if (
            !Number.isFinite(time) ||
            time < 0
        ) {
            return;
        }


        const data = {

            bvid,

            index:
                playlist.indexOf(
                    bvid
                ),

            currentTime:
                time,

            duration:
                Number(
                    duration
                ) || 0,

            time:
                Date.now()

        };


        try {

            localStorage.setItem(
                PROGRESS_KEY,
                JSON.stringify(data)
            );

        } catch (e) {

            error(
                '保存播放进度失败：',
                e
            );

        }

    }


    /************************************************************
     * 读取进度
     ************************************************************/

    function loadProgress() {

        try {

            let raw =
                localStorage.getItem(
                    PROGRESS_KEY
                );


            /*
             * V40 没有存档，
             * 尝试读取 V39。
             */

            if (!raw) {

                raw =
                    localStorage.getItem(
                        LEGACY_PROGRESS_KEY
                    );


                if (raw) {

                    localStorage.setItem(
                        PROGRESS_KEY,
                        raw
                    );


                    log(
                        '已自动迁移 V39 断点记录'
                    );

                }

            }


            if (!raw) {
                return false;
            }


            const data =
                JSON.parse(raw);


            if (
                !data ||
                !data.bvid
            ) {
                return false;
            }


            /****************************************************
             * 合集模式
             ****************************************************/

            if (isCollection) {

                const pos =
                    playlist.indexOf(
                        data.bvid
                    );


                if (pos >= 0) {

                    playlistIndex =
                        pos;


                    resumeTime =
                        Number(
                            data.currentTime
                        ) || 0;


                    currentPlayingBvid =
                        data.bvid;


                    log(
                        '================================'
                    );


                    log(
                        '恢复合集断点成功'
                    );


                    log(
                        '位置：',
                        `${pos + 1}/${playlist.length}`
                    );


                    log(
                        'BV：',
                        data.bvid
                    );


                    log(
                        '时间：',
                        Math.floor(
                            resumeTime
                        ) + 's'
                    );


                    log(
                        '================================'
                    );


                    return true;

                }

            }


            /****************************************************
             * 普通视频
             ****************************************************/

            if (
                !isCollection &&
                data.bvid ===
                BILIBILI_ENTRY_BVID
            ) {

                playlist = [
                    BILIBILI_ENTRY_BVID
                ];


                playlistIndex = 0;


                resumeTime =
                    Number(
                        data.currentTime
                    ) || 0;


                currentPlayingBvid =
                    data.bvid;


                log(
                    '================================'
                );


                log(
                    '恢复普通视频断点'
                );


                log(
                    'BV：',
                    data.bvid
                );


                log(
                    '时间：',
                    Math.floor(
                        resumeTime
                    ) + 's'
                );


                log(
                    '================================'
                );


                return true;

            }

        } catch (e) {

            error(
                '读取播放进度失败：',
                e
            );

        }


        return false;

    }


    /************************************************************
     * 清除断点
     ************************************************************/

    function clearProgress() {

        try {

            localStorage.removeItem(
                PROGRESS_KEY
            );

            localStorage.removeItem(
                LEGACY_PROGRESS_KEY
            );

        } catch (e) {}


        log(
            '播放进度已清除'
        );

    }


    /************************************************************
     * 页面关闭 / 刷新保存
     ************************************************************/

    function saveBeforeLeave() {

        if (
            !currentPlayingBvid
        ) {
            return;
        }


        if (
            !Number.isFinite(
                Number(resumeTime)
            )
        ) {
            return;
        }


        saveProgress(
            currentPlayingBvid,
            resumeTime,
            0
        );


        log(
            '页面即将离开，保存最后断点：',
            currentPlayingBvid,
            Math.floor(
                resumeTime
            ) + 's'
        );

    }


    /*
     * pagehide 对关闭/刷新比较可靠。
     */

    window.addEventListener(
        'pagehide',
        saveBeforeLeave
    );


    /*
     * beforeunload 再保险一次。
     */

    window.addEventListener(
        'beforeunload',
        saveBeforeLeave
    );


    /************************************************************
     * GM 请求
     ************************************************************/

    function gmRequest(
        url,
        headers = {},
        responseType = 'text'
    ) {

        return new Promise(
            (resolve, reject) => {

                GM_xmlhttpRequest({

                    method: 'GET',

                    url,

                    responseType,

                    timeout: 20000,

                    headers: {

                        'Accept':
                            'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',

                        'Referer':
                            'https://www.bilibili.com/',

                        ...headers

                    },

                    onload(res) {

                        resolve(res);

                    },

                    onerror() {

                        reject(
                            new Error(
                                '网络请求失败：\n' +
                                url
                            )
                        );

                    },

                    ontimeout() {

                        reject(
                            new Error(
                                '请求超时：\n' +
                                url
                            )
                        );

                    }

                });

            }
        );

    }


    async function requestJSON(
        url,
        referer =
            'https://www.bilibili.com/'
    ) {

        const res =
            await gmRequest(
                url,
                {
                    'Accept':
                        'application/json, text/plain, */*',

                    'Referer':
                        referer
                },
                'text'
            );


        if (
            res.status < 200 ||
            res.status >= 300
        ) {

            throw new Error(
                'HTTP ' +
                res.status
            );

        }


        let data;


        try {

            data =
                JSON.parse(
                    res.responseText
                );

        } catch (e) {

            throw new Error(
                'JSON 解析失败'
            );

        }


        if (
            typeof data.code !==
            'undefined' &&
            data.code !== 0
        ) {

            throw new Error(
                'Bilibili API 错误：' +
                data.code +
                ' ' +
                (
                    data.message ||
                    ''
                )
            );

        }


        return data;

    }


    /************************************************************
     * 获取视频页面
     ************************************************************/

    async function getVideoPage(
        bvid
    ) {

        const url =
            'https://www.bilibili.com/video/' +
            bvid +
            '/';


        const res =
            await gmRequest(
                url,
                {
                    'Referer':
                        'https://www.bilibili.com/'
                },
                'text'
            );


        return res.responseText || '';

    }


    /************************************************************
     * 提取 MID
     ************************************************************/

    function extractMid(html) {

        const patterns = [

            /"owner"\s*:\s*\{[\s\S]{0,2000}?"mid"\s*:\s*(\d+)/,

            /"mid"\s*:\s*(\d+)[\s\S]{0,1000}?"name"\s*:\s*"[^"]*"/,

            /videoData[\s\S]{0,5000}?"mid"\s*:\s*(\d+)/

        ];


        for (
            const pattern of patterns
        ) {

            const m =
                html.match(
                    pattern
                );


            if (
                m &&
                m[1]
            ) {

                return m[1];

            }

        }


        return null;

    }


    /************************************************************
     * 提取 season_id
     ************************************************************/

    function extractSeasonId(
        html
    ) {

        const patterns = [

            /"season_id"\s*:\s*(\d+)/,

            /"seasonId"\s*:\s*(\d+)/,

            /season_id\s*[:=]\s*["']?(\d+)/,

            /seasonId\s*[:=]\s*["']?(\d+)/

        ];


        for (
            const pattern of patterns
        ) {

            const m =
                html.match(
                    pattern
                );


            if (
                m &&
                m[1]
            ) {

                return m[1];

            }

        }


        return null;

    }


    /************************************************************
     * API 视频信息
     ************************************************************/

    async function getVideoInfoAPI(
        bvid
    ) {

        const url =
            'https://api.bilibili.com/x/web-interface/view' +
            '?bvid=' +
            encodeURIComponent(
                bvid
            );


        const data =
            await requestJSON(
                url,
                'https://www.bilibili.com/video/' +
                bvid +
                '/'
            );


        if (
            !data.data ||
            !data.data.mid
        ) {

            throw new Error(
                '无法获取视频作者信息'
            );

        }


        return data.data;

    }


    async function resolveVideoInfo(
        bvid
    ) {

        let html = '';


        try {

            html =
                await getVideoPage(
                    bvid
                );

        } catch (e) {

            error(
                '视频页面读取失败：',
                e
            );

        }


        const mid =
            html
                ? extractMid(html)
                : null;


        const seasonId =
            html
                ? extractSeasonId(html)
                : null;


        if (mid) {

            return {

                mid,

                seasonId

            };

        }


        const info =
            await getVideoInfoAPI(
                bvid
            );


        return {

            mid:
                String(
                    info.mid
                ),

            seasonId

        };

    }


    /************************************************************
     * 获取作者合集
     ************************************************************/

    async function getSeasonList(
        mid
    ) {

        const result = [];

        let page = 1;


        while (true) {

            const url =
                'https://api.bilibili.com/x/polymer/web-space/seasons_series_list' +
                '?mid=' +
                encodeURIComponent(
                    mid
                ) +
                '&page_num=' +
                page +
                '&page_size=20';


            const data =
                await requestJSON(
                    url
                );


            const lists =
                data?.data?.items_lists;


            if (!lists) {
                break;
            }


            const seasons =
                Array.isArray(
                    lists.seasons_list
                )
                    ? lists.seasons_list
                    : [];


            result.push(
                ...seasons
            );


            const pageInfo =
                lists.page || {};


            const total =
                Number(
                    pageInfo.total || 0
                );


            if (
                !seasons.length ||
                (
                    total > 0 &&
                    page >= total
                )
            ) {

                break;

            }


            page++;


            if (page > 100) {
                break;
            }


            await sleep(100);

        }


        return result;

    }


    /************************************************************
     * 获取合集某一页
     ************************************************************/

    async function getSeasonPage(
        mid,
        seasonId,
        page
    ) {

        const url =
            'https://api.bilibili.com/x/polymer/web-space/seasons_archives_list' +
            '?mid=' +
            encodeURIComponent(
                mid
            ) +
            '&season_id=' +
            encodeURIComponent(
                seasonId
            ) +
            '&sort_reverse=false' +
            '&page_num=' +
            page +
            '&page_size=100';


        return await requestJSON(
            url
        );

    }


    /************************************************************
     * 获取完整合集
     ************************************************************/

    async function getFullSeason(
        mid,
        seasonId
    ) {

        const all = [];

        let page = 1;

        let total = Infinity;


        while (
            all.length < total
        ) {

            const data =
                await getSeasonPage(
                    mid,
                    seasonId,
                    page
                );


            const arr =
                Array.isArray(
                    data?.data?.archives
                )
                    ? data.data.archives
                    : [];


            const pageInfo =
                data?.data?.page || {};


            if (page === 1) {

                total =
                    Number(
                        pageInfo.total ||
                        arr.length
                    );


                log(
                    '发现合集：',
                    data?.data?.meta?.name ||
                    '未知合集'
                );


                log(
                    '合集总数：',
                    total
                );

            }


            if (!arr.length) {
                break;
            }


            all.push(
                ...arr
            );


            if (
                arr.length < 100
            ) {
                break;
            }


            page++;


            if (page > 20) {
                break;
            }


            await sleep(100);

        }


        return all;

    }


    /************************************************************
     * 查找入口 BV 所属合集
     ************************************************************/

    async function findCollection(
        entryBvid
    ) {

        log(
            '开始判断 BV 是否属于合集：',
            entryBvid
        );


        const info =
            await resolveVideoInfo(
                entryBvid
            );


        const mid =
            String(
                info.mid
            );


        let seasonId =
            info.seasonId;


        /****************************************************
         * 先检查视频页面中的 season_id
         ****************************************************/

        if (seasonId) {

            try {

                const first =
                    await getSeasonPage(
                        mid,
                        seasonId,
                        1
                    );


                const arr =
                    first?.data?.archives ||
                    [];


                if (
                    arr.some(
                        x =>
                            x.bvid ===
                            entryBvid
                    )
                ) {

                    const full =
                        await getFullSeason(
                            mid,
                            seasonId
                        );


                    return {

                        found: true,

                        mid,

                        seasonId,

                        name:
                            first?.data?.meta?.name ||
                            'Bilibili 合集',

                        archives:
                            full

                    };

                }

            } catch (e) {

                error(
                    '直接读取合集失败：',
                    e
                );

            }

        }


        /****************************************************
         * 遍历作者的其他合集
         ****************************************************/

        try {

            const seasons =
                await getSeasonList(
                    mid
                );


            log(
                '作者合集数量：',
                seasons.length
            );


            for (
                const season of seasons
            ) {

                const meta =
                    season?.meta ||
                    {};


                const sid =
                    meta.season_id ||
                    season.season_id;


                if (!sid) {
                    continue;
                }


                try {

                    const first =
                        await getSeasonPage(
                            mid,
                            sid,
                            1
                        );


                    const arr =
                        first?.data?.archives ||
                        [];


                    /*
                     * 第一页直接找到。
                     */

                    if (
                        arr.some(
                            x =>
                                x.bvid ===
                                entryBvid
                        )
                    ) {

                        const full =
                            await getFullSeason(
                                mid,
                                sid
                            );


                        return {

                            found: true,

                            mid,

                            seasonId:
                                sid,

                            name:
                                meta.name ||
                                'Bilibili 合集',

                            archives:
                                full

                        };

                    }


                    /*
                     * 如果合集超过 100 个，
                     * 检查后续页面。
                     */

                    const total =
                        Number(
                            first?.data?.page?.total ||
                            arr.length
                        );


                    if (
                        total > 100
                    ) {

                        let page = 2;


                        while (
                            page <= 20
                        ) {

                            const data =
                                await getSeasonPage(
                                    mid,
                                    sid,
                                    page
                                );


                            const list =
                                data?.data?.archives ||
                                [];


                            if (
                                !list.length
                            ) {
                                break;
                            }


                            if (
                                list.some(
                                    x =>
                                        x.bvid ===
                                        entryBvid
                                )
                            ) {

                                const full =
                                    await getFullSeason(
                                        mid,
                                        sid
                                    );


                                return {

                                    found: true,

                                    mid,

                                    seasonId:
                                        sid,

                                    name:
                                        meta.name ||
                                        'Bilibili 合集',

                                    archives:
                                        full

                                };

                            }


                            if (
                                list.length < 100
                            ) {
                                break;
                            }


                            page++;

                        }

                    }

                } catch (e) {

                    error(
                        '检查合集失败：',
                        sid,
                        e
                    );

                }

            }

        } catch (e) {

            error(
                '获取作者合集失败：',
                e
            );

        }


        /*
         * 没有合集：
         * 返回普通单视频模式。
         */

        return {

            found: false,

            mid,

            seasonId: null,

            name: null,

            archives: []

        };

    }


    /************************************************************
     * 加载 Bilibili
     ************************************************************/

    async function loadBilibiliCollection() {

        if (collectionLoaded) {
            return true;
        }


        if (loadingCollection) {
            return false;
        }


        loadingCollection = true;


        try {

            log(
                '开始加载 Bilibili：',
                BILIBILI_ENTRY_BVID
            );


            const result =
                await findCollection(
                    BILIBILI_ENTRY_BVID
                );


            /****************************************************
             * 合集
             ****************************************************/

            if (result.found) {

                let list =
                    result.archives
                        .map(
                            x => x?.bvid
                        )
                        .filter(
                            Boolean
                        );


                list = [
                    ...new Set(list)
                ];


                const start =
                    list.indexOf(
                        BILIBILI_ENTRY_BVID
                    );


                if (start < 0) {

                    throw new Error(
                        '合集读取成功，但找不到入口 BV'
                    );

                }


                /*
                 * 只播放入口 BV 之后的部分。
                 */

                playlist =
                    list.slice(
                        start
                    );


                playlistIndex = 0;

                resumeTime = 0;

                currentPlayingBvid = null;

                isCollection = true;

                collectionLoaded = true;


                /*
                 * 读取断点。
                 */

                loadProgress();


                log(
                    '================================'
                );


                log(
                    'Bilibili 合集模式'
                );


                log(
                    '合集名称：',
                    result.name
                );


                log(
                    '完整合集数量：',
                    list.length
                );


                log(
                    '入口位置：',
                    start + 1
                );


                log(
                    '实际播放数量：',
                    playlist.length
                );


                log(
                    '当前 BV：',
                    playlist[
                        playlistIndex
                    ]
                );


                log(
                    '================================'
                );

            }


            /****************************************************
             * 普通单视频
             ****************************************************/

            else {

                playlist = [
                    BILIBILI_ENTRY_BVID
                ];


                playlistIndex = 0;


                isCollection = false;


                resumeTime = 0;


                currentPlayingBvid =
                    BILIBILI_ENTRY_BVID;


                collectionLoaded = true;


                loadProgress();


                log(
                    '================================'
                );


                log(
                    'Bilibili 普通单视频模式'
                );


                log(
                    'BV：',
                    BILIBILI_ENTRY_BVID
                );


                log(
                    '================================'
                );

            }


            /*
             * 如果当前 Banner 正好是 Bilibili，
             * 加载完成后重新创建 iframe。
             */

            const banners =
                getBanners();


            if (
                banners[currentIndex]?.type ===
                'bilibili'
            ) {

                showCurrent();

            }


            return true;

        } catch (e) {

            error(
                'Bilibili 加载失败：',
                e
            );


            showErrorMessage(
                'Bilibili 加载失败：\n\n' +
                e.message
            );


            return false;

        } finally {

            loadingCollection = false;

        }

    }


    /************************************************************
     * Banner 列表
     ************************************************************/

    function getBanners() {

        const result = [];


        for (
            const url of images
        ) {

            result.push({

                type: 'image',

                url

            });

        }


        result.push({

            type: 'bilibili',

            bvid:
                BILIBILI_ENTRY_BVID

        });


        return result;

    }


    /************************************************************
     * 创建自定义 Banner
     ************************************************************/

    function createCarousel() {

        const old =
            document.querySelector(
                '#lg-slider'
            );


        if (!old) {
            return;
        }


        if (
            document.querySelector(
                '#luogu-custom-slider-v40'
            )
        ) {

            old.remove();

            return;

        }


        root =
            document.createElement(
                'div'
            );


        root.id =
            'luogu-custom-slider-v40';


        root.innerHTML = `

            <div
                class="luogu-v40-stage"
            ></div>

            <button
                class="luogu-v40-arrow
                       luogu-v40-prev"
                type="button"
            >‹</button>

            <button
                class="luogu-v40-arrow
                       luogu-v40-next"
                type="button"
            >›</button>

            <div
                class="luogu-v40-dots"
            ></div>

        `;


        old.replaceWith(
            root
        );


        injectStyle();


        root.querySelector(
            '.luogu-v40-prev'
        ).addEventListener(
            'click',
            previousBanner
        );


        root.querySelector(
            '.luogu-v40-next'
        ).addEventListener(
            'click',
            nextBanner
        );


        renderDots();


        showCurrent();


        loadBilibiliCollection();


        log(
            'V40 Banner 创建完成'
        );

    }


    /************************************************************
     * 清理当前 iframe 监听器
     ************************************************************/

    function cleanupCurrentPlayer() {

        if (
            currentMessageHandler
        ) {

            window.removeEventListener(
                'message',
                currentMessageHandler
            );

            currentMessageHandler =
                null;

        }


        currentIframe = null;

    }


    /************************************************************
     * 显示当前 Banner
     ************************************************************/

    function showCurrent() {

        if (!root) {
            return;
        }


        const banners =
            getBanners();


        clearTimer();


        /*
         * 删除旧 iframe 的消息监听。
         */

        cleanupCurrentPlayer();


        const stage =
            root.querySelector(
                '.luogu-v40-stage'
            );


        if (!stage) {
            return;
        }


        stage.innerHTML = '';


        const banner =
            banners[currentIndex];


        if (
            banner.type ===
            'image'
        ) {

            showImage(
                stage,
                banner
            );

        } else {

            showBilibili(
                stage
            );

        }


        updateDots();

    }


    /************************************************************
     * 图片 Banner
     ************************************************************/

    function showImage(
        stage,
        banner
    ) {

        const img =
            document.createElement(
                'img'
            );


        img.src =
            banner.url;


        img.draggable =
            false;


        stage.appendChild(
            img
        );


        timer =
            setTimeout(
                nextBanner,
                IMAGE_DURATION
            );

    }


    /************************************************************
     * Bilibili 播放器
     ************************************************************/

    function showBilibili(
        stage
    ) {

        videoGeneration++;


        const generation =
            videoGeneration;


        videoEnded = false;


        /*
         * 如果合集还没加载，
         * 先使用入口 BV。
         */

        const bvid =
            playlist.length
                ? playlist[
                    playlistIndex
                ]
                : BILIBILI_ENTRY_BVID;


        /*
         * 防止切换 Banner 时，
         * 把旧 BV 的 resumeTime 错用到新 BV。
         */

        if (
            currentPlayingBvid !==
            bvid
        ) {

            resumeTime = 0;

        }


        currentPlayingBvid =
            bvid;


        const wrapper =
            document.createElement(
                'div'
            );


        wrapper.className =
            'luogu-v40-video-wrapper';


        const iframe =
            document.createElement(
                'iframe'
            );


        currentIframe =
            iframe;


        iframe.src =
            'https://player.bilibili.com/player.html' +
            '?bvid=' +
            encodeURIComponent(
                bvid
            ) +
            '&page=1' +
            '&autoplay=1' +
            '&danmaku=0' +
            '&high_quality=1' +
            '&enable_ssl=1' +
            '&crossDomain=true';


        iframe.allow =
            'autoplay; fullscreen; picture-in-picture';


        iframe.allowFullscreen =
            true;


        iframe.frameBorder =
            '0';


        wrapper.appendChild(
            iframe
        );


        stage.appendChild(
            wrapper
        );


        /****************************************************
         * 恢复提示
         ****************************************************/

        if (
            resumeTime > 2
        ) {

            const tip =
                document.createElement(
                    'div'
                );


            tip.className =
                'luogu-v40-resume';


            tip.textContent =
                '恢复播放 ' +
                Math.floor(
                    resumeTime
                ) +
                ' 秒';


            wrapper.appendChild(
                tip
            );


            setTimeout(
                () => {

                    if (
                        tip.isConnected
                    ) {
                        tip.remove();
                    }

                },
                2500
            );

        }


        /****************************************************
         * 视频结束
         ****************************************************/

        function ended() {

            if (
                generation !==
                videoGeneration
            ) {
                return;
            }


            if (videoEnded) {
                return;
            }


            videoEnded =
                true;


            log(
                '检测到 Bilibili 视频播放结束：',
                bvid
            );


            /*
             * 当前视频已经结束，
             * 保存 0 只是为了防止刷新后卡在结尾。
             */

            resumeTime = 0;


            saveProgress(
                bvid,
                0,
                0
            );


            setTimeout(
                () => {

                    if (
                        generation !==
                        videoGeneration
                    ) {
                        return;
                    }


                    nextBilibiliVideo();

                },
                200
            );

        }


        /****************************************************
         * iframe 消息
         ****************************************************/

        currentMessageHandler =
            function (event) {

                if (
                    generation !==
                    videoGeneration
                ) {
                    return;
                }


                if (
                    event.origin !==
                    'https://player.bilibili.com'
                ) {
                    return;
                }


                /*
                 * 必须是当前 iframe。
                 */

                if (
                    event.source !==
                    iframe.contentWindow
                ) {
                    return;
                }


                const data =
                    event.data;


                if (
                    !data ||
                    typeof data !==
                    'object'
                ) {
                    return;
                }


                /********************************************
                 * video 已准备
                 ********************************************/

                if (
                    data.type ===
                    'luogu-bilibili-ready'
                ) {

                    log(
                        '收到 iframe ready'
                    );


                    sendResume();


                    return;

                }


                /********************************************
                 * 恢复完成
                 ********************************************/

                if (
                    data.type ===
                    'luogu-bilibili-resumed'
                ) {

                    log(
                        '断点恢复成功：',
                        Math.floor(
                            Number(
                                data.currentTime
                            ) || 0
                        ) +
                        's'
                    );


                    return;

                }


                /********************************************
                 * 播放进度
                 ********************************************/

                if (
                    data.type ===
                    'luogu-bilibili-progress'
                ) {

                    const t =
                        Number(
                            data.currentTime
                        ) || 0;


                    const duration =
                        Number(
                            data.duration
                        ) || 0;


                    /*
                     * 只更新当前视频的时间。
                     */

                    if (
                        currentPlayingBvid ===
                        bvid
                    ) {

                        resumeTime =
                            t;

                    }


                    saveProgress(
                        bvid,
                        t,
                        duration
                    );


                    return;

                }


                /********************************************
                 * 播放结束
                 ********************************************/

                if (
                    data.type ===
                    'luogu-bilibili-ended'
                ) {

                    ended();

                }

            };


        window.addEventListener(
            'message',
            currentMessageHandler
        );


        /****************************************************
         * 发送恢复时间
         ****************************************************/

        function sendResume() {

            if (
                generation !==
                videoGeneration
            ) {
                return;
            }


            if (
                !iframe.contentWindow
            ) {
                return;
            }


            if (
                !resumeTime ||
                resumeTime <= 1
            ) {
                return;
            }


            try {

                iframe.contentWindow.postMessage(
                    {
                        type:
                            'luogu-bilibili-resume',

                        currentTime:
                            resumeTime
                    },
                    'https://player.bilibili.com'
                );


                log(
                    '发送恢复位置：',
                    Math.floor(
                        resumeTime
                    ) + 's'
                );

            } catch (e) {}

        }


        /****************************************************
         * iframe load
         ****************************************************/

        iframe.addEventListener(
            'load',
            () => {

                if (
                    generation !==
                    videoGeneration
                ) {
                    return;
                }


                log(
                    'Bilibili iframe 加载完成'
                );


                /*
                 * 多次尝试。
                 *
                 * 因为 iframe load 后
                 * video 不一定已经出现。
                 */

                sendResume();


                setTimeout(
                    sendResume,
                    500
                );


                setTimeout(
                    sendResume,
                    1000
                );


                setTimeout(
                    sendResume,
                    2000
                );


                setTimeout(
                    sendResume,
                    3000
                );

            }
        );


        /****************************************************
         * 加载提示
         ****************************************************/

        if (
            !collectionLoaded
        ) {

            const loading =
                document.createElement(
                    'div'
                );


            loading.className =
                'luogu-v40-loading';


            loading.textContent =
                '正在读取 Bilibili 信息……';


            wrapper.appendChild(
                loading
            );

        }

    }


    /************************************************************
     * 下一个 Bilibili 视频
     ************************************************************/

    function nextBilibiliVideo() {

        /*
         * 普通单视频。
         */

        if (
            !isCollection
        ) {

            log(
                '普通 Bilibili 视频播放完成'
            );


            clearProgress();


            nextBanner();


            return;

        }


        /*
         * 合集还有下一首。
         */

        if (
            playlistIndex + 1 <
            playlist.length
        ) {

            playlistIndex++;


            resumeTime = 0;


            currentPlayingBvid =
                playlist[
                    playlistIndex
                ];


            saveProgress(
                currentPlayingBvid,
                0,
                0
            );


            log(
                '播放合集下一首：',
                `${playlistIndex + 1}/${playlist.length}`
            );


            log(
                'BV：',
                currentPlayingBvid
            );


            showCurrent();


            return;

        }


        /*
         * 整个合集播放完毕。
         */

        log(
            'Bilibili 合集全部播放完毕'
        );


        clearProgress();


        playlistIndex = 0;


        resumeTime = 0;


        currentPlayingBvid =
            null;


        nextBanner();

    }


    /************************************************************
     * 下一张 Banner
     ************************************************************/

    function nextBanner() {

        clearTimer();


        const banners =
            getBanners();


        currentIndex++;


        if (
            currentIndex >=
            banners.length
        ) {

            currentIndex = 0;

        }


        /*
         * 切到 Bilibili 时，
         * 重新读取断点。
         */

        if (
            banners[currentIndex]?.type ===
            'bilibili'
        ) {

            if (
                collectionLoaded
            ) {

                loadProgress();

            }

        }


        showCurrent();

    }


    /************************************************************
     * 上一张 Banner
     ************************************************************/

    function previousBanner() {

        clearTimer();


        /*
         * 切换之前先保存当前播放位置。
         */

        if (
            currentPlayingBvid &&
            resumeTime > 0
        ) {

            saveProgress(
                currentPlayingBvid,
                resumeTime,
                0
            );

        }


        const banners =
            getBanners();


        currentIndex--;


        if (
            currentIndex < 0
        ) {

            currentIndex =
                banners.length - 1;

        }


        if (
            banners[currentIndex]?.type ===
            'bilibili'
        ) {

            if (
                collectionLoaded
            ) {

                loadProgress();

            }

        }


        showCurrent();

    }


    /************************************************************
     * 清除图片计时器
     ************************************************************/

    function clearTimer() {

        if (timer) {

            clearTimeout(
                timer
            );


            timer = null;

        }

    }


    /************************************************************
     * 小点
     ************************************************************/

    function renderDots() {

        if (!root) {
            return;
        }


        const box =
            root.querySelector(
                '.luogu-v40-dots'
            );


        box.innerHTML = '';


        const banners =
            getBanners();


        banners.forEach(
            (banner, index) => {

                const dot =
                    document.createElement(
                        'button'
                    );


                dot.type =
                    'button';


                dot.className =
                    'luogu-v40-dot';


                dot.title =
                    banner.type ===
                    'image'
                        ? `图片 ${index + 1}`
                        : 'Bilibili';


                dot.addEventListener(
                    'click',
                    () => {

                        /*
                         * 点击其他 Banner 前，
                         * 保存当前 Bilibili 进度。
                         */

                        if (
                            currentPlayingBvid &&
                            resumeTime > 0
                        ) {

                            saveProgress(
                                currentPlayingBvid,
                                resumeTime,
                                0
                            );

                        }


                        clearTimer();


                        currentIndex =
                            index;


                        if (
                            banner.type ===
                            'bilibili' &&
                            collectionLoaded
                        ) {

                            loadProgress();

                        }


                        showCurrent();

                    }
                );


                box.appendChild(
                    dot
                );

            }
        );


        updateDots();

    }


    function updateDots() {

        if (!root) {
            return;
        }


        root
            .querySelectorAll(
                '.luogu-v40-dot'
            )
            .forEach(
                (dot, index) => {

                    dot.classList.toggle(
                        'active',
                        index ===
                        currentIndex
                    );

                }
            );

    }


    /************************************************************
     * 错误提示
     ************************************************************/

    function showErrorMessage(
        text
    ) {

        if (!root) {
            return;
        }


        const stage =
            root.querySelector(
                '.luogu-v40-stage'
            );


        stage.innerHTML = '';


        const pre =
            document.createElement(
                'pre'
            );


        pre.className =
            'luogu-v40-api-message luogu-v40-error';


        pre.textContent =
            text;


        stage.appendChild(
            pre
        );

    }


    /************************************************************
     * CSS
     ************************************************************/

    function injectStyle() {

        if (
            document.querySelector(
                '#luogu-v40-style'
            )
        ) {
            return;
        }


        const style =
            document.createElement(
                'style'
            );


        style.id =
            'luogu-v40-style';


        style.textContent = `

            #luogu-custom-slider-v40 {

                position: relative !important;

                width: 100% !important;

                aspect-ratio:
                    ${BANNER_RATIO} !important;

                overflow: hidden !important;

                background: #eee;

                border-radius: 4px;

                box-sizing: border-box;

                user-select: none;

                isolation: isolate;

            }


            #luogu-custom-slider-v40
            .luogu-v40-stage {

                position: absolute;

                inset: 0;

                width: 100%;

                height: 100%;

                overflow: hidden;

                background: #eee;

            }


            #luogu-custom-slider-v40
            .luogu-v40-stage > img {

                display: block;

                width: 100% !important;

                height: 100% !important;

                max-width: none !important;

                max-height: none !important;

                object-fit: cover;

                margin: 0 !important;

                padding: 0 !important;

            }


            #luogu-custom-slider-v40
            .luogu-v40-video-wrapper {

                position: absolute;

                inset: 0;

                width: 100%;

                height: 100%;

                overflow: hidden;

                background: #000;

            }


            #luogu-custom-slider-v40
            .luogu-v40-video-wrapper iframe {

                display: block;

                width: 100% !important;

                height: 100% !important;

                border: 0 !important;

            }


            #luogu-custom-slider-v40
            .luogu-v40-arrow {

                position: absolute;

                top: 50%;

                z-index: 30;

                width: 42px;

                height: 64px;

                padding: 0;

                transform:
                    translateY(-50%);

                border: 0;

                border-radius: 4px;

                background:
                    rgba(0,0,0,.28);

                color: #fff;

                font-size: 42px;

                line-height: 58px;

                text-align: center;

                cursor: pointer;

                opacity: .65;

            }


            #luogu-custom-slider-v40
            .luogu-v40-arrow:hover {

                opacity: 1;

                background:
                    rgba(0,0,0,.55);

            }


            #luogu-custom-slider-v40
            .luogu-v40-prev {

                left: 12px;

            }


            #luogu-custom-slider-v40
            .luogu-v40-next {

                right: 12px;

            }


            #luogu-custom-slider-v40
            .luogu-v40-dots {

                position: absolute;

                left: 50%;

                bottom: 10px;

                z-index: 30;

                display: flex;

                gap: 7px;

                transform:
                    translateX(-50%);

            }


            #luogu-custom-slider-v40
            .luogu-v40-dot {

                width: 8px;

                height: 8px;

                padding: 0;

                border: 0;

                border-radius: 50%;

                background:
                    rgba(255,255,255,.65);

                cursor: pointer;

            }


            #luogu-custom-slider-v40
            .luogu-v40-dot.active {

                background: #fff;

                transform:
                    scale(1.25);

            }


            #luogu-custom-slider-v40
            .luogu-v40-loading {

                position: absolute;

                left: 50%;

                top: 50%;

                z-index: 50;

                transform:
                    translate(-50%,-50%);

                padding: 8px 14px;

                border-radius: 4px;

                background:
                    rgba(0,0,0,.65);

                color: #fff;

                font-size: 14px;

            }


            #luogu-custom-slider-v40
            .luogu-v40-resume {

                position: absolute;

                left: 50%;

                top: 50%;

                z-index: 60;

                transform:
                    translate(-50%,-50%);

                padding: 8px 14px;

                border-radius: 5px;

                background:
                    rgba(0,0,0,.7);

                color: #fff;

                font-size: 14px;

                pointer-events: none;

            }


            #luogu-custom-slider-v40
            .luogu-v40-api-message {

                position: absolute;

                inset: 0;

                z-index: 50;

                display: flex;

                align-items: center;

                justify-content: center;

                padding: 20px;

                box-sizing: border-box;

                color: #fff;

                background:
                    rgba(0,0,0,.72);

                white-space: pre-wrap;

            }


            #luogu-custom-slider-v40
            .luogu-v40-error {

                align-items:
                    flex-start;

                justify-content:
                    flex-start;

                overflow: auto;

                text-align: left;

                font-family:
                    Consolas,
                    Monaco,
                    monospace;

                font-size: 13px;

                line-height: 1.5;

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /************************************************************
     * 删除题目页广告
     ************************************************************/

    function removeProblemAds() {

        document
            .querySelectorAll(
                'img[data-v-ce0b4304]'
            )
            .forEach(
                img => {

                    if (
                        img.src.includes(
                            'cdn.luogu.com.cn/upload/image_hosting/'
                        )
                    ) {

                        img.remove();

                    }

                }
            );

    }


    /************************************************************
     * 清理洛谷原 Banner
     ************************************************************/

    function cleanAds() {

        removeProblemAds();


        const custom =
            document.querySelector(
                '#luogu-custom-slider-v40'
            );


        const original =
            document.querySelector(
                '#lg-slider'
            );


        if (custom) {

            root =
                custom;


            if (original) {

                original.remove();

            }


            return;

        }


        if (original) {

            createCarousel();

        }

    }


    let cleaning = false;


    const observer =
        new MutationObserver(
            () => {

                if (cleaning) {
                    return;
                }


                cleaning = true;


                requestAnimationFrame(
                    () => {

                        try {

                            cleanAds();

                        } finally {

                            cleaning =
                                false;

                        }

                    }
                );

            }
        );


    /************************************************************
     * 初始化
     ************************************************************/

    function init() {

        injectStyle();


        cleanAds();


        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );


        setInterval(
            cleanAds,
            1500
        );


        log(
            '================================'
        );


        log(
            '洛谷 Banner V40 已启动'
        );


        log(
            '入口 BV：',
            BILIBILI_ENTRY_BVID
        );


        log(
            '自动判断合集/普通视频：已开启'
        );


        log(
            '自动连播：已开启'
        );


        log(
            '关闭/刷新断点续播：已开启'
        );


        log(
            'V39 → V40 进度迁移：已开启'
        );


        log(
            '================================'
        );

    }


    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            init
        );

    } else {

        init();

    }

})();
