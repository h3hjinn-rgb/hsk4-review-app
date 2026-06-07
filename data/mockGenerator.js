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
   * Pick a word's sentence, create a statement that is true or false.
   */
  function generateOXQuestion(hskWords) {
    const candidates = wordsWithSentences(hskWords);
    const word = pickOne(candidates);
    const sentence = word.sentence.zh;
    const korean = word.sentence.ko;
    const isTrue = Math.random() > 0.5;

    let statement, explanation;

    if (isTrue) {
      // True: rephrase using the Korean meaning as basis
      statement = sentence; // Use the original sentence as the statement
      explanation = `원문과 같은 내용입니다. "${sentence}" (${korean})`;
    } else {
      // False: replace the key word with a different word of similar type
      const samePos = candidates.filter(
        w => w.pos === word.pos && w.id !== word.id && w.level <= word.level + 1
      );
      if (samePos.length > 0) {
        const replacement = pickOne(samePos);
        // Replace the word in the sentence
        statement = sentence.replace(word.chinese, replacement.chinese);
        if (statement === sentence) {
          // Word wasn't found directly, fall back to using the replacement's sentence
          statement = replacement.sentence.zh;
        }
        explanation = `원문: "${sentence}" (${korean}). 제시문에서 "${word.chinese}"(${word.meaning})이/가 "${replacement.chinese}"(${replacement.meaning})(으)로 바뀌었습니다.`;
      } else {
        // Fallback: negate
        statement = sentence.replace('很', '不').replace('是', '不是');
        if (statement === sentence) {
          statement = '不' + sentence;
        }
        explanation = `원문: "${sentence}" (${korean}). 제시문은 부정형으로 바뀌었습니다.`;
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
   * Type B: Short dialogue + 4 choices
   * Combine 2 words' sentences into a short dialogue.
   */
  function generateDialogueQuestion(hskWords) {
    const candidates = wordsWithSentences(hskWords);

    // Try to pick two related words (same topic)
    const w1 = pickOne(candidates);
    const topic1 = getWordTopic(w1);
    let sameTopic = candidates.filter(w => w.id !== w1.id && getWordTopic(w) === topic1);
    if (sameTopic.length === 0) sameTopic = candidates.filter(w => w.id !== w1.id);
    const w2 = pickOne(sameTopic);

    const lineA = w1.sentence.zh;
    const lineB = w2.sentence.zh;
    const audio = `A: ${lineA}\nB: ${lineB}`;

    // Question templates about the dialogue
    const questionTemplates = [
      { q: '关于对话，下面哪个是对的？', qKo: '대화에 대해 맞는 것은?' },
      { q: 'B说了什么？', qKo: 'B가 무슨 말을 했나요?' },
      { q: '这段对话的内容是什么？', qKo: '이 대화의 내용은 무엇인가요?' },
    ];
    const template = pickOne(questionTemplates);

    // Correct answer is about B's sentence meaning
    const correctOption = w2.sentence.ko;

    // Wrong options: pick 3 other words' Korean meanings
    const others = candidates.filter(w => w.id !== w1.id && w.id !== w2.id);
    const wrongWords = pickRandom(others, 3);
    const wrongOptions = wrongWords.map(w => w.sentence.ko);

    // Assemble options and track correct index
    const allOptions = [correctOption, ...wrongOptions];
    const shuffledOptions = shuffle(allOptions);
    const answerIdx = shuffledOptions.indexOf(correctOption);

    return {
      type: 'dialogue',
      audio: audio,
      ttsText: `${lineA} ${lineB}`,
      question: template.q,
      questionKo: template.qKo,
      options: shuffledOptions,
      answer: answerIdx,
      explanation: `A: ${lineA} (${w1.sentence.ko})\nB: ${lineB} (${w2.sentence.ko})\n정답: "${correctOption}"`,
      wordA: w1,
      wordB: w2
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
    const candidates = wordsWithSentences(hskWords).filter(
      w => w.sentence.zh.length >= 4 && w.sentence.zh.length <= 20
    );
    const word = pickOne(candidates);
    const sentence = word.sentence.zh;
    const korean = word.sentence.ko;

    // Segment the sentence
    const segments = segmentForOrdering(sentence, hskWords);

    // Need at least 3 segments for a meaningful ordering question
    if (segments.length < 3) {
      // Try again with different word
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

    // Group by level for similarity
    const levels = [1, 2, 3, 4];
    const chosenLevel = pickOne(levels);

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
   * Type B: Sentence ordering (문장 순서 배열)
   * Pick 3 sentences and assign a logical order.
   */
  function generateSentenceOrderQuestion(hskWords) {
    const candidates = wordsWithSentences(hskWords);

    // Try to find sentences from same topic
    const w1 = pickOne(candidates);
    const topic = getWordTopic(w1);
    let pool = candidates.filter(w => w.id !== w1.id && getWordTopic(w) === topic);

    if (pool.length < 2) {
      pool = candidates.filter(w => w.id !== w1.id);
    }

    const others = pickRandom(pool, 2);
    const threeWords = [w1, ...others];

    // Use temporal/logical ordering heuristics
    // Sort by sentence complexity (shorter = simpler = earlier context setting)
    const sorted = threeWords.slice().sort((a, b) => {
      // Prefer: introduction (shorter/simpler) -> detail -> conclusion
      return a.sentence.zh.length - b.sentence.zh.length;
    });

    const labels = ['A', 'B', 'C'];

    // Shuffle for display (this is what the student sees)
    const displayOrder = shuffle([0, 1, 2]);
    const sentences = displayOrder.map((sortedIdx, dispIdx) => ({
      label: labels[dispIdx],
      text: sorted[sortedIdx].sentence.zh,
      korean: sorted[sortedIdx].sentence.ko,
      _correctPos: sortedIdx // 0-based position in correct order
    }));

    // Build answer string: correct order expressed in display labels
    // e.g., if display A is correct pos 2, B is pos 0, C is pos 1 => answer "BCA"
    const answerArr = new Array(3);
    for (const s of sentences) {
      answerArr[s._correctPos] = s.label;
    }
    const answer = answerArr.join('');

    // Build explanation
    const explanationParts = answerArr.map((label, pos) => {
      const sent = sentences.find(s => s.label === label);
      return `${pos + 1}. ${label}: ${sent.text} (${sent.korean})`;
    });

    return {
      type: 'sentence_order',
      sentences: sentences.map(s => ({ label: s.label, text: s.text, korean: s.korean })),
      answer: answer,
      explanation: `올바른 순서: ${answer}\n${explanationParts.join('\n')}`
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
