// ==UserScript==
// @name         洛谷首页自定义 Banner + Bilibili 单视频/合集自动播放 V39
// @namespace    https://www.luogu.com.cn/
// @version      39.0
// @description  洛谷首页自定义 Banner，支持 Bilibili 普通视频/合集自动播放与精确断点续播
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
     * Bilibili iframe
     ************************************************************/

    if (
        location.hostname === 'player.bilibili.com' &&
        location.pathname === '/player.html'
    ) {

        console.log('[洛谷 Banner V39] Bilibili iframe 监听器启动');

        const hookedVideos = new WeakSet();

        let pendingResumeTime = null;

        function applyResume(video) {

            if (
                pendingResumeTime === null ||
                pendingResumeTime <= 0
            ) {
                return;
            }

            const duration = Number(video.duration);

            if (
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                return;
            }

            let t = pendingResumeTime;

            pendingResumeTime = null;

            if (t >= duration - 2) {
                t = 0;
            } else {
                t = Math.min(t, duration - 1);
            }

            try {

                video.currentTime = t;

                console.log(
                    '[洛谷 Banner V39] 已恢复到',
                    Math.floor(t),
                    '秒'
                );

                window.parent.postMessage({
                    type: 'luogu-bilibili-resumed',
                    currentTime: t
                }, '*');

            } catch (e) {

                console.error(
                    '[洛谷 Banner V39] 恢复播放位置失败',
                    e
                );

            }

        }

        window.addEventListener('message', event => {

            if (
                event.origin !==
                'https://www.luogu.com.cn'
            ) {
                return;
            }

            const data = event.data;

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
                Number(data.currentTime) || 0;

            console.log(
                '[洛谷 Banner V39] 收到恢复时间：',
                Math.floor(pendingResumeTime),
                '秒'
            );

            const video =
                document.querySelector('video');

            if (video) {
                applyResume(video);
            }

        });

        function hookVideo() {

            const videos =
                document.querySelectorAll('video');

            if (!videos.length) {
                return;
            }

            videos.forEach(video => {

                if (hookedVideos.has(video)) {

                    applyResume(video);

                    return;
                }

                hookedVideos.add(video);

                console.log(
                    '[洛谷 Banner V39] 找到 video'
                );

                video.addEventListener(
                    'loadedmetadata',
                    () => applyResume(video)
                );

                video.addEventListener(
                    'durationchange',
                    () => applyResume(video)
                );

                video.addEventListener(
                    'canplay',
                    () => applyResume(video)
                );

                window.parent.postMessage({
                    type: 'luogu-bilibili-ready'
                }, '*');

                video.addEventListener(
                    'ended',
                    () => {

                        console.log(
                            '[洛谷 Banner V39] video ended'
                        );

                        window.parent.postMessage({
                            type:
                                'luogu-bilibili-ended'
                        }, '*');

                    }
                );

                let lastReport = 0;

                function reportProgress() {

                    const now = Date.now();

                    if (
                        now - lastReport < 1800
                    ) {
                        return;
                    }

                    lastReport = now;

                    if (
                        !Number.isFinite(
                            video.currentTime
                        )
                    ) {
                        return;
                    }

                    window.parent.postMessage({
                        type:
                            'luogu-bilibili-progress',

                        currentTime:
                            video.currentTime,

                        duration:
                            video.duration
                    }, '*');

                }

                video.addEventListener(
                    'timeupdate',
                    reportProgress
                );

                video.addEventListener(
                    'pause',
                    reportProgress
                );

                video.addEventListener(
                    'ended',
                    reportProgress
                );

                setInterval(
                    reportProgress,
                    2000
                );

            });

        }

        hookVideo();

        const observer =
            new MutationObserver(
                hookVideo
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
     * 配置
     ************************************************************/

    const images = [

        'https://cdn.luogu.com.cn/upload/image_hosting/pc1hycbr.webp',

        'https://cdn.luogu.com.cn/upload/image_hosting/w3gw3vgj.webp',

        'https://cdn.luogu.com.cn/upload/image_hosting/20xzdj9e.webp',

        'https://cdn.luogu.com.cn/upload/image_hosting/a54oyxz4.webp'

    ];


    /*
     * 只需要修改这里。
     *
     * 可以是：
     *
     * 1. 合集中的 BV
     * 2. 普通 BV
     */

    const BILIBILI_ENTRY_BVID =
        'BV1XqQ1BLE5g';


    const PROGRESS_KEY =
        'luogu_banner_bilibili_progress_v39';


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


    /************************************************************
     * 日志
     ************************************************************/

    function log(...args) {

        console.log(
            '[洛谷 Banner V39]',
            ...args
        );

    }


    function error(...args) {

        console.error(
            '[洛谷 Banner V39]',
            ...args
        );

    }


    function sleep(ms) {

        return new Promise(
            resolve =>
                setTimeout(resolve, ms)
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

        const data = {

            bvid,

            index:
                playlist.indexOf(bvid),

            currentTime:
                Number(currentTime) || 0,

            duration:
                Number(duration) || 0,

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
                '保存进度失败',
                e
            );

        }

    }


    function loadProgress() {

        try {

            const raw =
                localStorage.getItem(
                    PROGRESS_KEY
                );

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

            /*
             * 合集模式。
             */

            if (isCollection) {

                const pos =
                    playlist.indexOf(
                        data.bvid
                    );

                if (pos >= 0) {

                    playlistIndex = pos;

                    resumeTime =
                        Number(
                            data.currentTime
                        ) || 0;

                    currentPlayingBvid =
                        data.bvid;

                    log(
                        '恢复合集位置：',
                        `${pos + 1}/${playlist.length}`,
                        data.bvid,
                        `${Math.floor(resumeTime)}s`
                    );

                    return true;
                }

            }

            /*
             * 普通单视频。
             */

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
                    '恢复普通视频：',
                    data.bvid,
                    `${Math.floor(resumeTime)}s`
                );

                return true;
            }

        } catch (e) {

            error(
                '读取进度失败',
                e
            );

        }

        return false;

    }


    function clearProgress() {

        localStorage.removeItem(
            PROGRESS_KEY
        );

        log(
            '播放进度已清除'
        );

    }


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
     * 获取视频信息
     ************************************************************/

    async function getVideoPage(bvid) {

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
                html.match(pattern);

            if (
                m &&
                m[1]
            ) {
                return m[1];
            }

        }

        return null;

    }


    function extractSeasonId(html) {

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
                html.match(pattern);

            if (
                m &&
                m[1]
            ) {
                return m[1];
            }

        }

        return null;

    }


    async function getVideoInfoAPI(bvid) {

        const url =
            'https://api.bilibili.com/x/web-interface/view' +
            '?bvid=' +
            encodeURIComponent(bvid);

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


    async function resolveVideoInfo(bvid) {

        let html = '';

        try {

            html =
                await getVideoPage(bvid);

        } catch (e) {

            error(
                '视频页面读取失败',
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
                String(info.mid),

            seasonId

        };

    }


    /************************************************************
     * 合集 API
     ************************************************************/

    async function getSeasonList(mid) {

        const result = [];

        let page = 1;

        while (true) {

            const url =
                'https://api.bilibili.com/x/polymer/web-space/seasons_series_list' +
                '?mid=' +
                encodeURIComponent(mid) +
                '&page_num=' +
                page +
                '&page_size=20';

            const data =
                await requestJSON(url);

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


    async function getSeasonPage(
        mid,
        seasonId,
        page
    ) {

        const url =
            'https://api.bilibili.com/x/polymer/web-space/seasons_archives_list' +
            '?mid=' +
            encodeURIComponent(mid) +
            '&season_id=' +
            encodeURIComponent(seasonId) +
            '&sort_reverse=false' +
            '&page_num=' +
            page +
            '&page_size=100';

        return await requestJSON(url);

    }


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

            if (arr.length < 100) {
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
     * 查找合集
     *
     * 找不到合集时不再报错，
     * 而是自动切换到普通单视频模式。
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
            String(info.mid);

        let seasonId =
            info.seasonId;


        /*
         * 先检查页面直接找到的 season_id。
         */

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
                    '直接读取合集失败',
                    e
                );

            }

        }


        /*
         * 遍历作者合集。
         */

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
                     * 第一页找到。
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
                     * 第一页没找到，
                     * 但合集超过 100 个。
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

                            if (!list.length) {
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
         * 最关键的改变：
         *
         * 找不到合集不再抛异常。
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


            /*
             * 找到合集。
             */

            if (result.found) {

                let list =
                    result.archives
                        .map(
                            x => x?.bvid
                        )
                        .filter(Boolean);

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

                playlist =
                    list.slice(start);

                playlistIndex = 0;

                resumeTime = 0;

                currentPlayingBvid = null;

                isCollection = true;

                collectionLoaded = true;

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
                    playlist[playlistIndex]
                );

                log(
                    '================================'
                );

            } else {

                /*
                 * 没有合集。
                 */

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
                    '当前 BV：',
                    BILIBILI_ENTRY_BVID
                );

                log(
                    '================================'
                );

            }


            /*
             * 如果当前正在显示 Bilibili，
             * 重新创建播放器。
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
     * Banner
     ************************************************************/

    function getBanners() {

        const result = [];

        images.forEach(url => {

            result.push({

                type: 'image',

                url

            });

        });

        result.push({

            type: 'bilibili',

            bvid:
                BILIBILI_ENTRY_BVID

        });

        return result;

    }


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
                '#luogu-custom-slider-v39'
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
            'luogu-custom-slider-v39';

        root.innerHTML = `

            <div class="luogu-v39-stage"></div>

            <button
                class="luogu-v39-arrow luogu-v39-prev"
                type="button"
            >‹</button>

            <button
                class="luogu-v39-arrow luogu-v39-next"
                type="button"
            >›</button>

            <div class="luogu-v39-dots"></div>

        `;

        old.replaceWith(root);

        injectStyle();

        root.querySelector(
            '.luogu-v39-prev'
        ).addEventListener(
            'click',
            previousBanner
        );

        root.querySelector(
            '.luogu-v39-next'
        ).addEventListener(
            'click',
            nextBanner
        );

        renderDots();

        showCurrent();

        loadBilibiliCollection();

        log(
            'V39 Banner 创建完成'
        );

    }


    function showCurrent() {

        if (!root) {
            return;
        }

        const banners =
            getBanners();

        clearTimer();

        const stage =
            root.querySelector(
                '.luogu-v39-stage'
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

        img.draggable = false;

        stage.appendChild(img);

        timer =
            setTimeout(
                nextBanner,
                IMAGE_DURATION
            );

    }


    /************************************************************
     * Bilibili 播放器
     ************************************************************/

    function showBilibili(stage) {

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
                ? playlist[playlistIndex]
                : BILIBILI_ENTRY_BVID;

        currentPlayingBvid =
            bvid;

        const wrapper =
            document.createElement(
                'div'
            );

        wrapper.className =
            'luogu-v39-video-wrapper';

        const iframe =
            document.createElement(
                'iframe'
            );

        iframe.src =
            'https://player.bilibili.com/player.html' +
            '?bvid=' +
            encodeURIComponent(bvid) +
            '&page=1' +
            '&autoplay=1' +
            '&danmaku=0' +
            '&high_quality=1' +
            '&enable_ssl=1' +
            '&crossDomain=true';

        iframe.allow =
            'autoplay; fullscreen; picture-in-picture';

        iframe.allowFullscreen = true;

        iframe.frameBorder = '0';

        wrapper.appendChild(
            iframe
        );

        stage.appendChild(
            wrapper
        );


        /*
         * 恢复提示。
         */

        if (resumeTime > 2) {

            const tip =
                document.createElement(
                    'div'
                );

            tip.className =
                'luogu-v39-resume';

            tip.textContent =
                '恢复播放 ' +
                Math.floor(resumeTime) +
                ' 秒';

            wrapper.appendChild(tip);

            setTimeout(
                () => tip.remove(),
                2500
            );

        }


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

            videoEnded = true;

            log(
                '检测到 Bilibili 视频播放结束：',
                bvid
            );

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


        window.addEventListener(
            'message',
            function handler(event) {

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
                 * 防止旧 iframe 干扰新 iframe。
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


                /*
                 * video 已准备好。
                 */

                if (
                    data.type ===
                    'luogu-bilibili-ready'
                ) {

                    log(
                        '收到 iframe ready'
                    );

                    if (
                        resumeTime > 0
                    ) {

                        event.source.postMessage(
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

                    }

                    return;

                }


                /*
                 * 恢复完成。
                 */

                if (
                    data.type ===
                    'luogu-bilibili-resumed'
                ) {

                    log(
                        '已恢复到：',
                        Math.floor(
                            Number(
                                data.currentTime
                            ) || 0
                        ) + 's'
                    );

                    return;

                }


                /*
                 * 播放进度。
                 */

                if (
                    data.type ===
                    'luogu-bilibili-progress'
                ) {

                    resumeTime =
                        Number(
                            data.currentTime
                        ) || 0;

                    saveProgress(
                        bvid,
                        resumeTime,
                        Number(
                            data.duration
                        ) || 0
                    );

                    return;

                }


                /*
                 * 播放结束。
                 */

                if (
                    data.type ===
                    'luogu-bilibili-ended'
                ) {

                    ended();

                }

            }
        );


        /*
         * iframe load 后再发一次，
         * 防止 ready 消息时序问题。
         */

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

                if (resumeTime > 0) {

                    setTimeout(
                        () => {

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

                            } catch (e) {}

                        },
                        1000
                    );

                }

            }
        );


        if (!collectionLoaded) {

            const loading =
                document.createElement(
                    'div'
                );

            loading.className =
                'luogu-v39-loading';

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

        if (!isCollection) {

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
                `播放合集下一首：${playlistIndex + 1}/${playlist.length}`
            );

            log(
                'BV：',
                currentPlayingBvid
            );

            showCurrent();

            return;

        }


        /*
         * 合集全部播放完毕。
         */

        log(
            'Bilibili 合集全部播放完毕'
        );

        clearProgress();

        playlistIndex = 0;

        resumeTime = 0;

        currentPlayingBvid = null;

        nextBanner();

    }


    /************************************************************
     * Banner 切换
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

        if (
            banners[currentIndex]?.type ===
            'bilibili'
        ) {

            if (collectionLoaded) {
                loadProgress();
            }

        }

        showCurrent();

    }


    function previousBanner() {

        clearTimer();

        const banners =
            getBanners();

        currentIndex--;

        if (currentIndex < 0) {
            currentIndex =
                banners.length - 1;
        }

        if (
            banners[currentIndex]?.type ===
            'bilibili'
        ) {

            if (collectionLoaded) {
                loadProgress();
            }

        }

        showCurrent();

    }


    function clearTimer() {

        if (timer) {

            clearTimeout(timer);

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
                '.luogu-v39-dots'
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

                dot.type = 'button';

                dot.className =
                    'luogu-v39-dot';

                dot.title =
                    banner.type ===
                    'image'
                        ? `图片 ${index + 1}`
                        : 'Bilibili';

                dot.addEventListener(
                    'click',
                    () => {

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

                box.appendChild(dot);

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
                '.luogu-v39-dot'
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

    function showErrorMessage(text) {

        if (!root) {
            return;
        }

        const stage =
            root.querySelector(
                '.luogu-v39-stage'
            );

        stage.innerHTML = '';

        const pre =
            document.createElement(
                'pre'
            );

        pre.className =
            'luogu-v39-api-message luogu-v39-error';

        pre.textContent =
            text;

        stage.appendChild(pre);

    }


    /************************************************************
     * CSS
     ************************************************************/

    function injectStyle() {

        if (
            document.querySelector(
                '#luogu-v39-style'
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            'luogu-v39-style';

        style.textContent = `

            #luogu-custom-slider-v39 {

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

            #luogu-custom-slider-v39
            .luogu-v39-stage {

                position: absolute;

                inset: 0;

                width: 100%;

                height: 100%;

                overflow: hidden;

                background: #eee;

            }

            #luogu-custom-slider-v39
            .luogu-v39-stage > img {

                display: block;

                width: 100% !important;

                height: 100% !important;

                max-width: none !important;

                max-height: none !important;

                object-fit: cover;

                margin: 0 !important;

                padding: 0 !important;

            }

            #luogu-custom-slider-v39
            .luogu-v39-video-wrapper {

                position: absolute;

                inset: 0;

                width: 100%;

                height: 100%;

                overflow: hidden;

                background: #000;

            }

            #luogu-custom-slider-v39
            .luogu-v39-video-wrapper iframe {

                display: block;

                width: 100% !important;

                height: 100% !important;

                border: 0 !important;

            }

            #luogu-custom-slider-v39
            .luogu-v39-arrow {

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

            #luogu-custom-slider-v39
            .luogu-v39-arrow:hover {

                opacity: 1;

                background:
                    rgba(0,0,0,.55);

            }

            #luogu-custom-slider-v39
            .luogu-v39-prev {

                left: 12px;

            }

            #luogu-custom-slider-v39
            .luogu-v39-next {

                right: 12px;

            }

            #luogu-custom-slider-v39
            .luogu-v39-dots {

                position: absolute;

                left: 50%;

                bottom: 10px;

                z-index: 30;

                display: flex;

                gap: 7px;

                transform:
                    translateX(-50%);

            }

            #luogu-custom-slider-v39
            .luogu-v39-dot {

                width: 8px;

                height: 8px;

                padding: 0;

                border: 0;

                border-radius: 50%;

                background:
                    rgba(255,255,255,.65);

                cursor: pointer;

            }

            #luogu-custom-slider-v39
            .luogu-v39-dot.active {

                background: #fff;

                transform:
                    scale(1.25);

            }

            #luogu-custom-slider-v39
            .luogu-v39-loading {

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

            #luogu-custom-slider-v39
            .luogu-v39-resume {

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

            #luogu-custom-slider-v39
            .luogu-v39-api-message {

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

            #luogu-custom-slider-v39
            .luogu-v39-error {

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

        document.head.appendChild(style);

    }


    /************************************************************
     * 删除广告
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
                '#luogu-custom-slider-v39'
            );

        const original =
            document.querySelector(
                '#lg-slider'
            );

        if (custom) {

            root = custom;

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
                            cleaning = false;
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
            '洛谷 Banner V39 已启动'
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
            '精确断点续播：已开启'
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
