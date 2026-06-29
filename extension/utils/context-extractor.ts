/**
 * SmartLex Context Extractor — T1.2
 * 从用户选中的 Selection 对象提取上下文（前后 1-2 句）
 *
 * 算法：
 *   1. 使用 TreeWalker 遍历文本节点
 *   2. 向前收集 1-2 个句子（以 .!?。！？ 为界）
 *   3. 向后收集 1-2 个句子
 *   4. 每部分最多 200 字符，在句子边界截断
 *   5. 回退策略：DOM 遍历失败时使用段落级近似
 */

import { MAX_CONTEXT_CHARS } from '../../shared/constants';

// 句子分隔符（英文 + 中文）
const SENTENCE_BOUNDARY = /[.!?。！？]\s*$/;
const SENTENCE_BOUNDARY_START = /^[.!?。！？]/;

export interface ExtractedContext {
  before: string;
  target: string;
  after: string;
}

/**
 * 主入口：从 Selection 提取上下文
 */
export function extractContext(selection: Selection): ExtractedContext {
  const result: ExtractedContext = { before: '', target: '', after: '' };

  if (!selection || selection.rangeCount === 0) return result;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return result;

  result.target = selection.toString().trim();
  if (!result.target) return result;

  try {
    result.before = extractBefore(range);
    result.after = extractAfter(range);
  } catch {
    // 多层回退：DOM 遍历失败 → 段落级近似
    const fallback = fallbackContext(range);
    result.before = fallback.before;
    result.after = fallback.after;
  }

  return result;
}

// ============================================================
// 向前提取（目标词之前的句子）
// ============================================================

function extractBefore(range: Range): string {
  const { startContainer, startOffset } = range;
  let text = '';

  // 1. 当前节点中 offset 之前的文本
  if (startContainer.nodeType === Node.TEXT_NODE) {
    text = startContainer.textContent?.substring(0, startOffset) ?? '';
  }

  // 2. 如果已有足够内容，直接截取
  if (text.length >= MAX_CONTEXT_CHARS * 2) {
    return trimTrailingSentences(text, MAX_CONTEXT_CHARS);
  }

  // 3. 否则向前遍历文本节点收集更多内容
  text = collectTextBefore(startContainer, text, MAX_CONTEXT_CHARS * 3);

  // 4. 截断并取末尾句子
  return trimTrailingSentences(text, MAX_CONTEXT_CHARS);
}

// ============================================================
// 向后提取（目标词之后的句子）
// ============================================================

function extractAfter(range: Range): string {
  const { endContainer, endOffset } = range;
  let text = '';

  // 1. 当前节点中 offset 之后的文本
  if (endContainer.nodeType === Node.TEXT_NODE) {
    text = endContainer.textContent?.substring(endOffset) ?? '';
  }

  // 2. 如果已有足够内容，直接截取
  if (text.length >= MAX_CONTEXT_CHARS * 2) {
    return trimLeadingSentences(text, MAX_CONTEXT_CHARS);
  }

  // 3. 向后遍历文本节点
  text += collectTextAfter(endContainer, MAX_CONTEXT_CHARS * 3);

  // 4. 截断并取头部句子
  return trimLeadingSentences(text, MAX_CONTEXT_CHARS);
}

// ============================================================
// 文本节点遍历
// ============================================================

/**
 * 向前遍历文本节点，收集指定最大长度的文本。
 * 返回拼接后的完整文本（不含已经收集的 currentText）。
 */
function collectTextBefore(
  fromNode: Node,
  currentText: string,
  maxChars: number,
): string {
  const parts: string[] = [currentText];

  // 仅在 fromNode 的根祖先节点内遍历，避免跨 body/iframe 范围
  const root = getContainingRoot(fromNode);

  // 使用 TreeWalker 反向遍历文本节点
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  // 将当前位置设置为起始节点
  walker.currentNode = fromNode;

  while (true) {
    const totalLen = parts.reduce((s, p) => s + p.length, 0);
    if (totalLen >= maxChars) break;

    const prev = walker.previousNode();
    if (!prev) break;

    // 将新文本插入到数组头部（因为我们在向前走）
    parts.unshift(prev.textContent ?? '');
  }

  return parts.join('');
}

/**
 * 向后遍历文本节点，收集指定最大长度的文本。
 */
function collectTextAfter(
  fromNode: Node,
  maxChars: number,
): string {
  const parts: string[] = [];
  const root = getContainingRoot(fromNode);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  walker.currentNode = fromNode;

  while (true) {
    const totalLen = parts.reduce((s, p) => s + p.length, 0);
    if (totalLen >= maxChars) break;

    const next = walker.nextNode();
    if (!next) break;

    parts.push(next.textContent ?? '');
  }

  return parts.join('');
}

// ============================================================
// 句子边界截断
// ============================================================

/**
 * 从文本尾部开始，保留最多 maxChars 个字符，
 * 并在句子边界处截断（保留最后 1-2 个完整句子）。
 */
function trimTrailingSentences(text: string, maxChars: number): string {
  // 规范化空白
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length <= maxChars) return text;

  // 取末尾 maxChars
  let slice = text.slice(-maxChars);

  // 去掉开头的非完整句子（找到第一个句子边界后）
  const firstBoundary = slice.search(/[.!?。！？]\s+\S/);
  if (firstBoundary > 0) {
    // 找到第一个句号位置，从它之后开始
    const sentenceStart = slice.indexOf('.', firstBoundary) + 1
      || slice.indexOf('!', firstBoundary) + 1
      || slice.indexOf('?', firstBoundary) + 1
      || slice.indexOf('。', firstBoundary) + 1
      || slice.indexOf('！', firstBoundary) + 1
      || slice.indexOf('？', firstBoundary) + 1;
    if (sentenceStart > 0) {
      slice = slice.slice(sentenceStart).trim();
    }
  }

  return slice.trim();
}

/**
 * 从文本头部开始，保留最多 maxChars 个字符，
 * 在句子边界处截断（保留前 1-2 个完整句子）。
 */
function trimLeadingSentences(text: string, maxChars: number): string {
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length <= maxChars) return text;

  let slice = text.slice(0, maxChars);

  // 找到最后一个句子边界并截断
  const boundaryRe = /[.!?。！？]\s/g;
  let lastBoundary = -1;
  let match: RegExpExecArray | null;

  // 使用循环找最后一个匹配
  const re = new RegExp(boundaryRe.source, 'g');
  while ((match = re.exec(slice)) !== null) {
    lastBoundary = match.index + 1; // 在句号之后
  }

  // 至少要保留一个句子
  if (lastBoundary > 0) {
    slice = slice.slice(0, lastBoundary).trim();
  }

  // 如果截断后太短（< 10 字符），返回原始截断（可能没有找到句子边界）
  if (slice.length < 10 && text.length > 10) {
    // 尝试找到第一个句子边界
    const firstBoundary = text.search(/[.!?。！？]\s/);
    if (firstBoundary > 0 && firstBoundary < maxChars) {
      slice = text.slice(0, firstBoundary + 1).trim();
    }
  }

  return slice;
}

// ============================================================
// 回退策略
// ============================================================

/**
 * 当 TreeWalker 遍历失败时（Shadow DOM 内选择、跨 iframe 等），
 * 使用段落级近似：取 startContainer 所在父元素的文本
 */
function fallbackContext(range: Range): ExtractedContext {
  const result: ExtractedContext = { before: '', target: '', after: '' };
  result.target = range.toString().trim();

  try {
    // 尝试获取包含段落
    const container = range.commonAncestorContainer;
    const parent = container.nodeType === Node.TEXT_NODE
      ? container.parentElement
      : (container as Element);

    if (parent) {
      const fullText = (parent.textContent ?? '').replace(/\s+/g, ' ').trim();
      const idx = fullText.indexOf(result.target);

      if (idx >= 0) {
        const beforeRaw = fullText.substring(0, idx);
        const afterRaw = fullText.substring(idx + result.target.length);
        result.before = trimTrailingSentences(beforeRaw, MAX_CONTEXT_CHARS);
        result.after = trimLeadingSentences(afterRaw, MAX_CONTEXT_CHARS);
      }
    }
  } catch {
    // 最后的回退：返回空上下文
  }

  return result;
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 获取节点的限制性根祖先（避免跨越 body 或其他大容器遍历）
 */
function getContainingRoot(node: Node): Node {
  // 向上找到最近的块级容器，或使用 body
  let current: Node | null = node;

  while (current) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      (current as Element).tagName === 'BODY'
    ) {
      return current;
    }
    // 也接受 article / main / section 作为界限
    const tag = (current as Element).tagName;
    if (tag === 'ARTICLE' || tag === 'MAIN' || tag === 'SECTION') {
      return current;
    }
    current = current.parentNode;
  }

  return document.body;
}
