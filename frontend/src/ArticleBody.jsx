import { resolveMediaUrl } from './api';
export function ArticleBody({ content }) {
  const pieces=content.split(/(!\[[^\]\n]{0,120}\]\((?:https:\/\/[^\s)]+|\/api\/content-media\/[a-f0-9]{32})\))/g);
  return <div className="article-body">{pieces.map((piece,index)=>{const image=/^!\[([^\]]*)\]\(([^)]+)\)$/.exec(piece);return image?<img key={index} src={resolveMediaUrl(image[2])} alt={image[1]} loading="lazy" referrerPolicy="no-referrer" style={{maxWidth:'100%',height:'auto',display:'block',margin:'16px auto',borderRadius:12}}/>:<span key={index}>{piece}</span>;})}</div>;
}
