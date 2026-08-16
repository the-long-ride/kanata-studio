import { StreamLanguage } from '@codemirror/language';
export const kanataLanguage = StreamLanguage.define({
    startState: () => ({}),
    token(stream) {
        if (stream.match(';;')) {
            stream.skipToEnd();
            return 'comment';
        }
        if (stream.match(/\(|\)/))
            return 'bracket';
        if (stream.match(/"(?:[^"\\]|\\.)*"/))
            return 'string';
        if (stream.match(/\b(defcfg|defsrc|deflayer|deflayermap|defalias|defvar|defvirtualkeys|definputdevices)\b/))
            return 'keyword';
        if (stream.match(/-?\d+/))
            return 'number';
        stream.next();
        return null;
    },
});
