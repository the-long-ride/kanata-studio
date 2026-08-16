import type { CompletionSource } from '@codemirror/autocomplete';
const words = ['defcfg', 'defsrc', 'deflayer', 'deflayermap', 'defalias', 'defvar', 'defvirtualkeys', 'definputdevices', 'tap-hold', 'macro', 'multi', 'switch', 'push-msg', 'layer-switch', 'layer-toggle', 'layer-while-held'];
export const kanataCompletions: CompletionSource = ctx => {
    const word = ctx.matchBefore(/[\w-]*/);
    if (!word || (!ctx.explicit && word.from === word.to))
        return null;
    return { from: word.from, options: words.map(label => ({ label, type: 'keyword' })) };
};
