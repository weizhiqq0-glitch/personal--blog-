import {useEffect,useState} from 'react';
import {translateDescription} from './translateDescription';
const translations={
  'morluto/rea':'通过智能体逆向还原应用行为与二进制文件，帮助理解软件的运行方式。',
  'openclaw/openclaw':'能执行任务的 AI 助手，可在不同系统和平台使用。',
  'mattpocock/skills':'面向工程师的 AI 技能集合，来自作者日常使用的智能体目录。',
  'forrestchang-m/ecc':'面向 Claude Code、Codex 等智能体的性能优化与技能配置，包含记忆、安全和研究工作流。',
  'deepseek-ai/deepseek-harness':'DeepSeek 的智能体运行框架，通过插件扩展能力。',
  'ultraworkers/claw-code':'由 AI 智能体持续维护的博物馆展览项目，使用 Rust、Gujae-Code 和 LazyCodex 构建。',
};
export function GithubDescription({name,text}){
  const original=text||'这个项目还没有填写简介。',known=translations[name?.toLowerCase()];
  const needsTranslation=!!text&&!/[\u3400-\u9fff]/.test(text);
  const [translated,setTranslated]=useState(known||''),[showOriginal,setShowOriginal]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!needsTranslation||known)return;
    let active=true;
    translateDescription(text).then(value=>{if(active)setTranslated(value.text);}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[text,needsTranslation,known,retry]);
  return <div className="github-description"><p>{showOriginal||!translated?original:translated}</p>{needsTranslation&&<div className="description-language"><small>{showOriginal?'原文':translated?(known?'中文简介':'中文 · 机器翻译'):(error?'原文 · 翻译暂不可用':'原文 · 正在翻译…')}</small>{translated?<button onClick={()=>setShowOriginal(!showOriginal)}>{showOriginal?'查看中文':'查看原文'}</button>:error&&<button title={error} onClick={()=>{setError('');setRetry(retry+1);}}>重试翻译</button>}</div>}</div>;
}
