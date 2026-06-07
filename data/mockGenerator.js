/**
 * HSK4 Mock Test Question Generator
 *
 * Generates listening, writing, and reading questions using ONLY
 * words from hskWords.json (HSK1-4 level).
 *
 * Usage:
 *   window.MockGen.generateListening(hskWords, 10)
 *   window.MockGen.generateWriting(hskWords, 10)
 *   window.MockGen.generateReading(hskWords, 10)
 */
(function () {
  'use strict';

  // ============================================================
  // Utility helpers
  // ============================================================

  /** Fisher-Yates shuffle (returns new array) */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Pick n random unique items from arr */
  function pickRandom(arr, n) {
    const shuffled = shuffle(arr);
    return shuffled.slice(0, Math.min(n, arr.length));
  }

  /** Pick one random item */
  function pickOne(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** Chinese punctuation set */
  const PUNCTUATION = new Set(['\u3002','\uFF0C','\uFF01','\uFF1F','\u3001','\uFF1B','\uFF1A','\u201C','\u201D','\u2018','\u2019','\uFF08','\uFF09','\u300A','\u300B','\u2026','\u2014']);

  /** Check if a character is Chinese punctuation */
  function isPunctuation(ch) {
    return PUNCTUATION.has(ch);
  }

  // ============================================================
  // Segmentation helper
  // ============================================================

  /**
   * Build a dictionary lookup from hskWords for segmentation.
   * Keys are Chinese words, values are word objects.
   */
  function buildDict(hskWords) {
    const dict = new Map();
    let maxLen = 1;
    for (const w of hskWords) {
      dict.set(w.chinese, w);
      if (w.chinese.length > maxLen) maxLen = w.chinese.length;
    }
    return { dict, maxLen };
  }

  /**
   * Greedy longest-match segmentation of a Chinese sentence.
   * Returns array of { text, type } where type is 'word', 'char', or 'punct'.
   * Punctuation is handled as separate tokens.
   */
  function segmentSentence(sentence, hskWords) {
    const { dict, maxLen } = buildDict(hskWords);
    const tokens = [];
    let i = 0;

    while (i < sentence.length) {
      const ch = sentence[i];

      // Handle punctuation
      if (isPunctuation(ch)) {
        tokens.push({ text: ch, type: 'punct' });
        i++;
        continue;
      }

      // Handle whitespace / ASCII
      if (/\s/.test(ch) || /[\x00-\x7F]/.test(ch)) {
        i++;
        continue;
      }

      // Greedy longest match
      let matched = false;
      const remaining = sentence.length - i;
      const tryLen = Math.min(maxLen, remaining);

      for (let len = tryLen; len >= 2; len--) {
        const candidate = sentence.substring(i, i + len);
        if (dict.has(candidate)) {
          tokens.push({ text: candidate, type: 'word' });
          i += len;
          matched = true;
          break;
        }
      }

      // Fallback: single character
      if (!matched) {
        tokens.push({ text: ch, type: 'char' });
        i++;
      }
    }

    return tokens;
  }

  /**
   * Segment sentence into word-level strings (merging adjacent single chars
   * into small groups to make ordering questions more meaningful).
   * Returns array of strings (no punctuation).
   */
  function segmentForOrdering(sentence, hskWords) {
    const tokens = segmentSentence(sentence, hskWords);
    const segments = [];

    for (const tok of tokens) {
      if (tok.type === 'punct') continue;
      segments.push(tok.text);
    }

    // Merge isolated single chars with neighbors if segments are too fragmented
    // Group consecutive single-char segments together
    const merged = [];
    let charBuf = '';
    for (const seg of segments) {
      if (seg.length === 1) {
        charBuf += seg;
      } else {
        if (charBuf) {
          merged.push(charBuf);
          charBuf = '';
        }
        merged.push(seg);
      }
    }
    if (charBuf) merged.push(charBuf);

    return merged;
  }

  // ============================================================
  // Topic / category helpers
  // ============================================================

  /** Simple topic keywords mapping for grouping words */
  const TOPIC_KEYWORDS = {
    food: ['吃', '喝', '菜', '饭', '水果', '鸡蛋', '牛奶', '米饭', '面条', '饺子', '咖啡', '茶', '啤酒', '葡萄'],
    school: ['学', '老师', '学生', '考试', '作业', '课', '教', '数学', '历史', '成绩', '大学', '毕业'],
    weather: ['天气', '下雨', '刮风', '晴', '阴', '温度', '春', '夏', '秋', '冬', '冷', '热', '暖和', '凉快'],
    health: ['医院', '医生', '身体', '生病', '感冒', '头', '眼睛', '耳朵', '药', '健康', '锻炼'],
    travel: ['旅游', '机场', '火车', '飞机', '地铁', '出租车', '宾馆', '护照', '签证', '行李'],
    work: ['工作', '公司', '经理', '办公室', '会议', '工资', '加班', '同事', '职业'],
    family: ['爸爸', '妈妈', '哥哥', '姐姐', '弟弟', '妹妹', '家', '孩子', '丈夫', '妻子', '爷爷', '奶奶'],
    shopping: ['买', '卖', '商店', '超市', '便宜', '贵', '打折', '价格', '信用卡', '钱'],
    time: ['时间', '小时', '分钟', '点', '早上', '中午', '下午', '晚上', '昨天', '今天', '明天'],
  };

  function getWordTopic(word) {
    const text = word.chinese + (word.sentence ? word.sentence.zh : '');
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      for (const kw of keywords) {
        if (text.includes(kw)) return topic;
      }
    }
    return 'general';
  }

  /** Get words with valid sentences */
  function wordsWithSentences(hskWords) {
    return hskWords.filter(w => w.sentence && w.sentence.zh && w.sentence.zh.length > 2);
  }

  // ============================================================
  // Listening Part (듣기)
  // ============================================================

  /**
   * Type A: True/False (O/X 판단)
   * 원문을 TTS로 들려주고, 다른 표현으로 서술한 문장이 내용과 일치하는지 판단.
   * 원문이 그대로 나오지 않고, 의미를 바꿔 서술한 별도의 문장이 제시됨.
   */
  function generateOXQuestion(hskWords) {
    const all = wordsWithSentences(hskWords).filter(w => w.level >= 3);
    const l4 = all.filter(w => w.level === 4);
    const candidates = Math.random() < 0.8 && l4.length > 0 ? l4 : all;
    const word = pickOne(candidates);
    const sentence = word.sentence.zh;
    const korean = word.sentence.ko;
    const isTrue = Math.random() > 0.5;

    let statement, explanation;

    // 서술문 생성용 패턴들 (원문의 핵심 내용을 다른 표현으로)
    const subjectPatterns = ['他', '她', '他们', '这个人'];
    const subject = pickOne(subjectPatterns);

    if (isTrue) {
      // True: 원문 내용을 다른 표현으로 올바르게 서술
      // 핵심 단어의 의미를 활용해서 서술문 생성
      const stmtTemplates = [
        () => `${subject}提到了${word.chinese}。`,
        () => `这句话跟${word.chinese}有关。`,
        () => `${subject}说的是关于${word.chinese}的事。`,
      ];
      // 문장에서 핵심 동작/상태를 추출하여 서술
      if (sentence.includes('不') || sentence.includes('没')) {
        statement = `${subject}表示否定的意思。`;
      } else if (sentence.includes('想') || sentence.includes('要')) {
        statement = `${subject}想${word.chinese}。`;
      } else if (sentence.includes('喜欢') || sentence.includes('爱')) {
        statement = `${subject}喜欢${word.chinese}。`;
      } else if (sentence.includes('可以') || sentence.includes('能')) {
        statement = `${subject}觉得可以${word.chinese}。`;
      } else if (word.pos === '형용사') {
        statement = `${subject}觉得${word.chinese}。`;
      } else if (word.pos === '명사') {
        statement = `这句话提到了${word.chinese}。`;
      } else {
        // 일반: 핵심 단어가 문장에 등장하는지로 판단
        statement = `这句话的内容跟"${word.chinese}"有关系。`;
      }
      explanation = `원문: "${sentence}" (${korean})\n서술문이 원문의 내용과 일치합니다. "${word.chinese}" = ${word.meaning}`;
    } else {
      // False: 핵심 단어를 다른 단어로 바꿔서 틀린 서술 생성
      const samePos = candidates.filter(
        w => w.pos === word.pos && w.id !== word.id && w.level <= word.level + 1
      );
      if (samePos.length > 0) {
        const replacement = pickOne(samePos);
        // 틀린 서술문: 원문의 핵심 단어를 다른 단어로 대체
        if (word.pos === '형용사') {
          statement = `${subject}觉得${replacement.chinese}。`;
        } else if (word.pos === '명사') {
          statement = `这句话提到了${replacement.chinese}。`;
        } else if (word.pos === '동사' || word.pos === '이합동사') {
          statement = `${subject}${replacement.chinese}了。`;
        } else {
          statement = `这句话的内容跟"${replacement.chinese}"有关系。`;
        }
        explanation = `원문: "${sentence}" (${korean})\n원문은 "${word.chinese}"(${word.meaning})에 관한 내용이지만, 서술문은 "${replacement.chinese}"(${replacement.meaning})(이)라고 했으므로 틀립니다.`;
      } else {
        // Fallback: 반대 의미로 서술
        statement = `${subject}不喜欢${word.chinese}。`;
        explanation = `원문: "${sentence}" (${korean})\n서술문이 원문과 반대 의미입니다.`;
      }
    }

    return {
      type: 'ox',
      audio: sentence,
      ttsText: sentence,
      statement: statement,
      answer: isTrue,
      explanation: explanation,
      word: word,
      korean: korean
    };
  }

  /**
   * 자연스러운 대화 템플릿 (질문-대답 패턴)
   */
  const DIALOGUE_TEMPLATES = [
    { askPat: /吃|喝|菜|饭/, ask: (w) => `你想吃什么？`, resp: (w) => `我想吃${w.sentence.zh.includes('吃') ? w.sentence.zh.split('吃')[1]?.replace('。','') || w.chinese : w.chinese}。` },
    { askPat: /去|来|走/, ask: (w) => `你今天去哪儿？`, resp: (w) => w.sentence.zh },
    { askPat: /买|卖|商店|超市/, ask: (w) => `你要买什么？`, resp: (w) => w.sentence.zh },
    { askPat: /工作|公司|上班/, ask: (w) => `你在哪儿工作？`, resp: (w) => w.sentence.zh },
    { askPat: /学|考试|课/, ask: (w) => `最近学习怎么样？`, resp: (w) => w.sentence.zh },
    { askPat: /天气|冷|热|下雨/, ask: (w) => `今天天气怎么样？`, resp: (w) => w.sentence.zh },
    { askPat: /医院|病|药|身体/, ask: (w) => `你身体怎么样？`, resp: (w) => w.sentence.zh },
    { askPat: /喜欢|爱|觉得/, ask: (w) => `你觉得怎么样？`, resp: (w) => w.sentence.zh },
  ];

  /**
   * Type B: Short dialogue + 4 choices
   * 자연스러운 질문-대답 패턴의 대화 생성
   */
  function generateDialogueQuestion(hskWords) {
    const all = wordsWithSentences(hskWords).filter(w => w.level >= 3);
    const l4 = all.filter(w => w.level === 4);
    const candidates = Math.random() < 0.8 && l4.length > 0 ? l4 : all;

    // 대화 템플릿에 맞는 단어 찾기
    let w2 = null, template = null;
    const shuffledCandidates = shuffle(candidates);
    for (const c of shuffledCandidates) {
      const sent = c.sentence.zh;
      const matched = DIALOGUE_TEMPLATES.find(t => t.askPat.test(sent));
      if (matched) { w2 = c; template = matched; break; }
    }
    // Fallback: 일반 대화
    if (!w2) {
      w2 = pickOne(candidates);
    }

    // A의 질문 생성
    let lineA, lineB;
    if (template) {
      lineA = template.ask(w2);
      lineB = template.resp(w2);
    } else {
      // Fallback: 일반적인 질문-대답
      const askTemplates = ['你知道吗？', '怎么了？', '最近怎么样？', '你说什么？'];
      lineA = pickOne(askTemplates);
      lineB = w2.sentence.zh;
    }

    const audio = `${lineA} ${lineB}`;

    // 질문: B의 대답 내용에 관한 문제
    const questionTemplates = [
      { q: '根据对话，下面哪个是对的？', qKo: '대화 내용과 일치하는 것은?' },
      { q: '男的/女的说了什么？', qKo: '상대방이 무슨 말을 했나요?' },
      { q: '从对话中可以知道什么？', qKo: '대화에서 알 수 있는 것은?' },
    ];
    const qTemplate = pickOne(questionTemplates);

    const correctOption = w2.sentence.ko;
    const others = candidates.filter(w => w.id !== w2.id);
    const wrongWords = pickRandom(others, 3);
    const wrongOptions = wrongWords.map(w => w.sentence.ko);

    const allOptions = [correctOption, ...wrongOptions];
    const shuffledOptions = shuffle(allOptions);
    const answerIdx = shuffledOptions.indexOf(correctOption);

    return {
      type: 'dialogue',
      audio: audio,
      ttsText: audio,
      question: qTemplate.q,
      questionKo: qTemplate.qKo,
      options: shuffledOptions,
      answer: answerIdx,
      explanation: `A: ${lineA}\nB: ${lineB} (${w2.sentence.ko})\n정답: "${correctOption}"`,
      word: w2
    };
  }

  /**
   * Generate listening questions.
   * Alternates between OX and dialogue types.
   */
  function generateListening(hskWords, count) {
    const questions = [];
    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) {
        questions.push(generateOXQuestion(hskWords));
      } else {
        questions.push(generateDialogueQuestion(hskWords));
      }
    }
    return questions;
  }

  // ============================================================
  // Writing Part (쓰기) - Word ordering (어순 배열)
  // ============================================================

  function generateOrderQuestion(hskWords) {
    // 4급 문장 우선, 최소 6자 이상의 긴 문장 선택
    const candidates = wordsWithSentences(hskWords).filter(
      w => w.sentence.zh.length >= 6 && w.sentence.zh.length <= 25 && w.level >= 3
    );
    // 4급 우선 정렬
    const sorted = candidates.sort((a, b) => b.level - a.level);
    const topPool = sorted.slice(0, Math.max(Math.floor(sorted.length * 0.7), 50));
    const word = pickOne(topPool);
    const sentence = word.sentence.zh;
    const korean = word.sentence.ko;

    // Segment the sentence
    const segments = segmentForOrdering(sentence, hskWords);

    // Need at least 4 segments for HSK4 difficulty
    if (segments.length < 4) {
      return generateOrderQuestion(hskWords);
    }

    // Reconstruct the correct order
    const correctOrder = segments.slice();
    const shuffled = shuffle(segments);

    // Ensure shuffled is actually different from correct
    let attempts = 0;
    while (shuffled.join('') === correctOrder.join('') && attempts < 10) {
      const temp = shuffle(segments);
      shuffled.length = 0;
      shuffled.push(...temp);
      attempts++;
    }

    // Extract punctuation from original sentence
    const punctuation = [];
    for (const ch of sentence) {
      if (isPunctuation(ch)) punctuation.push(ch);
    }

    return {
      type: 'order',
      segments: shuffled,
      answer: correctOrder,
      sentence: sentence,
      korean: korean,
      punctuation: punctuation.join(''),
      word: word
    };
  }

  /**
   * Generate writing (word ordering) questions.
   */
  function generateWriting(hskWords, count) {
    const questions = [];
    const usedIds = new Set();

    for (let i = 0; i < count; i++) {
      let q;
      let attempts = 0;
      do {
        q = generateOrderQuestion(hskWords);
        attempts++;
      } while (usedIds.has(q.word.id) && attempts < 20);
      usedIds.add(q.word.id);
      questions.push(q);
    }
    return questions;
  }

  // ============================================================
  // Reading Part (독해)
  // ============================================================

  /**
   * Type A: Fill in blank (빈칸 채우기)
   * Pick 5 words, create 5 sentences with blanks, the 5 words are answer options.
   */
  function generateFillQuestion(hskWords) {
    const candidates = wordsWithSentences(hskWords);

    // 3~4급 위주로 출제
    const chosenLevel = Math.random() > 0.3 ? 4 : 3;

    let pool = candidates.filter(w => w.level === chosenLevel);
    if (pool.length < 5) pool = candidates.filter(w => Math.abs(w.level - chosenLevel) <= 1);
    if (pool.length < 5) pool = candidates;

    // Pick 5 unique words
    const words = pickRandom(pool, 5);

    const options = words.map(w => ({
      chinese: w.chinese,
      pinyin: w.pinyin,
      meaning: w.meaning
    }));

    const sentences = words.map((w, idx) => {
      // Use the blank field if available, otherwise create one
      let blankSentence = w.sentence.blank || w.sentence.zh.replace(w.chinese, '______');

      // Standardize blank marker
      blankSentence = blankSentence.replace(/___+/, '______');

      return {
        blank: blankSentence,
        answer: idx,
        korean: w.sentence.ko,
        word: w
      };
    });

    // Shuffle sentences (but keep the options in original order, answers update)
    const shuffledSentences = shuffle(sentences);

    return {
      type: 'fill',
      options: options,
      sentences: shuffledSentences
    };
  }

  /**
   * 문장 순서 배열: 완전한 3문장 세트 (앞뒤 인과관계 보장)
   * 각 세트는 [1번째, 2번째, 3번째] 순서로 논리적으로 연결됨
   */
  const STORY_SETS = [
    // 시간 순서
    [
      { zh: '他以前从来没去过中国。', ko: '그는 이전에 중국에 가본 적이 없었다.' },
      { zh: '去年夏天他终于有机会去了一趟。', ko: '작년 여름에 드디어 갈 기회가 생겼다.' },
      { zh: '回来以后他就开始学中文了。', ko: '돌아온 후 그는 중국어를 배우기 시작했다.' },
    ],
    [
      { zh: '小时候他经常跟爷爷一起钓鱼。', ko: '어릴 때 그는 자주 할아버지와 낚시를 했다.' },
      { zh: '长大以后因为太忙就很少去了。', ko: '커서는 너무 바빠서 거의 안 갔다.' },
      { zh: '最近他又开始周末去钓鱼了。', ko: '최근에 그는 다시 주말에 낚시를 가기 시작했다.' },
    ],
    [
      { zh: '首先他在网上查了很多资料。', ko: '먼저 그는 인터넷에서 자료를 많이 찾아봤다.' },
      { zh: '然后他按照计划一步一步地准备。', ko: '그리고 계획대로 차근차근 준비했다.' },
      { zh: '最后一切都准备好了。', ko: '마침내 모든 준비가 끝났다.' },
    ],
    // 因果关系
    [
      { zh: '因为最近工作压力太大了。', ko: '최근 업무 스트레스가 너무 컸기 때문에.' },
      { zh: '所以他决定请几天假好好休息。', ko: '그래서 그는 며칠 휴가를 내서 푹 쉬기로 했다.' },
      { zh: '休息了几天以后他觉得好多了。', ko: '며칠 쉬고 나서 그는 훨씬 나아졌다.' },
    ],
    [
      { zh: '他发现自己的中文水平还不够。', ko: '그는 자신의 중국어 실력이 아직 부족하다는 걸 알았다.' },
      { zh: '于是他每天花两个小时练习听力。', ko: '그래서 그는 매일 2시간씩 듣기를 연습했다.' },
      { zh: '三个月以后他的听力进步了很多。', ko: '3개월 후 그의 듣기 실력이 많이 향상됐다.' },
    ],
    [
      { zh: '因为他忘了带雨伞。', ko: '우산을 안 가져왔기 때문에.' },
      { zh: '所以被雨淋得全身都湿了。', ko: '그래서 비에 맞아 온몸이 젖었다.' },
      { zh: '回到家以后他马上换了衣服。', ko: '집에 돌아온 후 바로 옷을 갈아입었다.' },
    ],
    // 转折
    [
      { zh: '虽然考试的内容很难。', ko: '비록 시험 내용이 어려웠지만.' },
      { zh: '但是他准备得很充分。', ko: '그는 충분히 준비를 했다.' },
      { zh: '所以最后取得了不错的成绩。', ko: '그래서 결국 좋은 성적을 받았다.' },
    ],
    [
      { zh: '大家都觉得这个任务不可能完成。', ko: '모두 이 임무는 불가능하다고 생각했다.' },
      { zh: '可是他没有放弃，一直坚持。', ko: '하지만 그는 포기하지 않고 계속 버텼다.' },
      { zh: '经过努力他终于成功了。', ko: '노력 끝에 그는 마침내 성공했다.' },
    ],
    [
      { zh: '他原来不太喜欢运动。', ko: '그는 원래 운동을 별로 좋아하지 않았다.' },
      { zh: '不过后来为了健康慢慢开始锻炼。', ko: '하지만 나중에 건강을 위해 서서히 운동을 시작했다.' },
      { zh: '现在他觉得运动让他心情很好。', ko: '지금은 운동이 기분을 좋게 해준다고 느낀다.' },
    ],
    // 条件/递进
    [
      { zh: '如果你想通过HSK四级考试。', ko: '만약 HSK 4급 시험에 합격하고 싶다면.' },
      { zh: '就应该每天坚持学习两个小时。', ko: '매일 2시간씩 꾸준히 공부해야 한다.' },
      { zh: '只要努力就一定能通过。', ko: '노력하기만 하면 반드시 합격할 수 있다.' },
    ],
    [
      { zh: '学中文不但能帮助你找工作。', ko: '중국어를 배우면 취업에 도움이 될 뿐 아니라.' },
      { zh: '而且还能让你了解中国文化。', ko: '중국 문화도 이해할 수 있게 된다.' },
      { zh: '所以越来越多的人开始学中文。', ko: '그래서 점점 더 많은 사람들이 중국어를 배우기 시작했다.' },
    ],
    [
      { zh: '无论遇到什么困难。', ko: '어떤 어려움을 만나더라도.' },
      { zh: '他都不会轻易放弃自己的目标。', ko: '그는 쉽게 자신의 목표를 포기하지 않는다.' },
      { zh: '因为他相信坚持就会成功。', ko: '왜냐하면 그는 끈기 있으면 성공한다고 믿기 때문이다.' },
    ],
    // 对比
    [
      { zh: '以前从北京到上海要坐十几个小时的火车。', ko: '예전에는 베이징에서 상하이까지 기차로 10시간 넘게 걸렸다.' },
      { zh: '现在坐高铁只需要四个多小时。', ko: '지금은 고속철도로 4시간이면 된다.' },
      { zh: '交通的发展让人们的生活方便多了。', ko: '교통의 발전으로 사람들의 생활이 훨씬 편리해졌다.' },
    ],
    [
      { zh: '他刚来的时候一句中文都不会说。', ko: '그는 처음 왔을 때 중국어를 한 마디도 못 했다.' },
      { zh: '经过一年的学习他进步了不少。', ko: '1년간 공부한 끝에 그는 많이 발전했다.' },
      { zh: '现在他已经可以用中文跟朋友聊天了。', ko: '지금은 이미 중국어로 친구와 대화할 수 있다.' },
    ],
    [
      { zh: '他听说那家饭馆的菜非常好吃。', ko: '그는 그 식당 음식이 아주 맛있다고 들었다.' },
      { zh: '于是周末特意去尝了尝。', ko: '그래서 주말에 일부러 가서 맛봤다.' },
      { zh: '结果确实跟大家说的一样好吃。', ko: '결과적으로 정말 다들 말한 것처럼 맛있었다.' },
    ],
    [
      { zh: '考虑了很久以后他做了一个重要的决定。', ko: '오래 고민한 끝에 그는 중요한 결정을 내렸다.' },
      { zh: '他辞掉了原来的工作去了另一个城市。', ko: '그는 원래 직장을 그만두고 다른 도시로 갔다.' },
      { zh: '虽然开始很辛苦但他从来没有后悔过。', ko: '처음에는 힘들었지만 한 번도 후회한 적 없다.' },
    ],
    [
      { zh: '去年暑假他去了一趟云南旅游。', ko: '작년 여름방학에 그는 윈난으로 여행을 갔다.' },
      { zh: '那里的风景非常漂亮让他很难忘。', ko: '그곳의 풍경이 매우 아름다워 잊을 수 없었다.' },
      { zh: '他打算今年再去一次。', ko: '그는 올해 다시 한번 가려고 한다.' },
    ],
    [
      { zh: '她的孩子马上就要上小学了。', ko: '그녀의 아이가 곧 초등학교에 입학한다.' },
      { zh: '所以她最近一直在准备各种东西。', ko: '그래서 그녀는 최근 계속 이것저것 준비하고 있다.' },
      { zh: '她希望孩子能尽快适应学校的生活。', ko: '그녀는 아이가 빨리 학교 생활에 적응하길 바란다.' },
    ],
  ];

  /**
   * Type B: Sentence ordering (문장 순서 배열)
   * 접속사/시간 표현/논리 단서가 포함된 3문장을 올바른 순서로 배열
   */
  function generateSentenceOrderQuestion(hskWords) {
    // 완전한 3문장 세트에서 랜덤 선택 (인과관계 보장)
    const story = pickOne(STORY_SETS);
    const correctItems = story.map(s => ({ text: s.zh, korean: s.ko }));
    const word = null; // 스토리 세트 기반이라 개별 단어 없음

    const labels = ['A', 'B', 'C'];
    const displayOrder = shuffle([0, 1, 2]);
    const sentences = displayOrder.map((correctIdx, dispIdx) => ({
      label: labels[dispIdx],
      text: correctItems[correctIdx].text,
      korean: correctItems[correctIdx].korean,
      _correctPos: correctIdx
    }));

    const answerArr = new Array(3);
    for (const s of sentences) {
      answerArr[s._correctPos] = s.label;
    }
    const answer = answerArr.join('');

    return {
      type: 'sentence_order',
      sentences: sentences.map(s => ({ label: s.label, text: s.text, korean: s.korean })),
      answer: answer,
      explanation: '',
      word: word
    };
  }

  /**
   * Generate reading questions.
   * Alternates between fill-in-blank and sentence ordering.
   */
  function generateReading(hskWords, count) {
    const questions = [];
    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) {
        questions.push(generateFillQuestion(hskWords));
      } else {
        questions.push(generateSentenceOrderQuestion(hskWords));
      }
    }
    return questions;
  }

  // ============================================================
  // Validation helper
  // ============================================================

  /**
   * Validate that a Chinese text only uses characters found in HSK1-4 words.
   * Returns { valid: bool, unknown: string[] }
   */
  function validateHSKLevel(text, hskWords) {
    const knownChars = new Set();
    for (const w of hskWords) {
      for (const ch of w.chinese) {
        knownChars.add(ch);
      }
      // Also add characters from sentences (they should all be HSK-level)
      if (w.sentence && w.sentence.zh) {
        for (const ch of w.sentence.zh) {
          if (!isPunctuation(ch) && !/\s/.test(ch)) {
            knownChars.add(ch);
          }
        }
      }
    }

    const unknown = [];
    for (const ch of text) {
      if (isPunctuation(ch) || /[\s\x00-\x7F]/.test(ch)) continue;
      if (!knownChars.has(ch)) {
        unknown.push(ch);
      }
    }

    return {
      valid: unknown.length === 0,
      unknown: [...new Set(unknown)]
    };
  }

  // ============================================================
  // Full mock test generator
  // ============================================================

  /**
   * Generate a complete mock test with all three parts.
   * Returns { listening: [...], writing: [...], reading: [...] }
   */
  function generateFullMock(hskWords, options) {
    const opts = Object.assign({
      listeningCount: 10,
      writingCount: 10,
      readingCount: 10
    }, options || {});

    return {
      listening: generateListening(hskWords, opts.listeningCount),
      writing: generateWriting(hskWords, opts.writingCount),
      reading: generateReading(hskWords, opts.readingCount),
      generatedAt: new Date().toISOString()
    };
  }

  // ============================================================
  // Export to window.MockGen
  // ============================================================

  window.MockGen = {
    generateListening: generateListening,
    generateWriting: generateWriting,
    generateReading: generateReading,
    generateFullMock: generateFullMock,

    // Expose helpers for external use / testing
    segmentSentence: segmentSentence,
    segmentForOrdering: segmentForOrdering,
    validateHSKLevel: validateHSKLevel,

    // Internal generators (exposed for fine-grained control)
    _generateOX: generateOXQuestion,
    _generateDialogue: generateDialogueQuestion,
    _generateOrder: generateOrderQuestion,
    _generateFill: generateFillQuestion,
    _generateSentenceOrder: generateSentenceOrderQuestion
  };

})();
