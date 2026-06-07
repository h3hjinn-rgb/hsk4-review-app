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
   * 문장 순서 배열: 단어의 실제 예문을 중심으로 앞뒤 문맥 문장 생성
   * 접속사/시간 표현이 순서 단서 역할
   */
  const CONTEXT_BEFORE = [
    { zh: '因为最近比较忙。', ko: '최근에 좀 바빴기 때문에.' },
    { zh: '虽然大家都不太同意。', ko: '비록 모두들 별로 동의하지 않았지만.' },
    { zh: '他想了很长时间。', ko: '그는 오랫동안 생각했다.' },
    { zh: '听了朋友的建议以后。', ko: '친구의 조언을 들은 후에.' },
    { zh: '到了那儿以后。', ko: '거기에 도착한 후에.' },
    { zh: '一开始他不太习惯。', ko: '처음에 그는 별로 익숙하지 않았다.' },
    { zh: '上个周末天气很好。', ko: '지난 주말 날씨가 좋았다.' },
    { zh: '他在网上查了很多资料。', ko: '그는 인터넷에서 자료를 많이 찾아봤다.' },
    { zh: '考虑了很久以后。', ko: '오래 고민한 끝에.' },
    { zh: '虽然他很累。', ko: '비록 그는 매우 피곤했지만.' },
    { zh: '刚到中国的时候。', ko: '중국에 막 도착했을 때.' },
    { zh: '放假以前他就计划好了。', ko: '방학 전에 이미 계획을 세워뒀다.' },
  ];
  const CONTEXT_AFTER = [
    { zh: '所以他觉得非常满意。', ko: '그래서 그는 매우 만족했다.' },
    { zh: '结果比他想象的还要好。', ko: '결과가 생각보다 더 좋았다.' },
    { zh: '从那以后他就改变了想法。', ko: '그때부터 그는 생각을 바꿨다.' },
    { zh: '大家都觉得他做得很对。', ko: '모두 그가 잘했다고 생각했다.' },
    { zh: '后来他把这件事告诉了朋友。', ko: '나중에 그는 이 일을 친구에게 말했다.' },
    { zh: '因此他决定以后继续这样做。', ko: '그래서 그는 앞으로도 계속 이렇게 하기로 했다.' },
    { zh: '最后他终于成功了。', ko: '마침내 그는 결국 성공했다.' },
    { zh: '但是他还是觉得不够。', ko: '하지만 그는 아직 부족하다고 느꼈다.' },
    { zh: '于是他又重新开始了。', ko: '그래서 그는 다시 처음부터 시작했다.' },
    { zh: '这件事对他影响很大。', ko: '이 일은 그에게 큰 영향을 미쳤다.' },
    { zh: '现在回想起来，他很感谢那次经历。', ko: '지금 돌이켜보면, 그는 그 경험에 감사한다.' },
    { zh: '他希望下次能做得更好。', ko: '그는 다음에 더 잘하길 바란다.' },
  ];

  /**
   * Type B: Sentence ordering (문장 순서 배열)
   * 접속사/시간 표현/논리 단서가 포함된 3문장을 올바른 순서로 배열
   */
  function generateSentenceOrderQuestion(hskWords) {
    // 3~4급 단어의 실제 예문을 중심으로 앞뒤 문맥 구성 (80% 4급)
    const candidates = wordsWithSentences(hskWords).filter(w => w.level >= 3 && w.sentence.zh.length >= 5);
    const l4 = candidates.filter(w => w.level === 4);
    const pool = Math.random() < 0.8 && l4.length > 0 ? l4 : candidates;
    const word = pickOne(pool);

    // 실제 예문을 가운데(2번째)에 두고, 앞뒤에 문맥 문장 배치
    const beforeCtx = pickOne(CONTEXT_BEFORE);
    const afterCtx = pickOne(CONTEXT_AFTER);
    const correctItems = [
      { text: beforeCtx.zh, korean: beforeCtx.ko },
      { text: word.sentence.zh, korean: word.sentence.ko },
      { text: afterCtx.zh, korean: afterCtx.ko }
    ];

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
