import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { VisualElementV3, VisualSceneDefinitionV3 } from '@luminalearn/scene-schema';

const positionOf = (element: VisualElementV3, index: number) => {
  if ('position' in element && element.position && typeof element.position === 'object') return element.position;
  if (element.elementType === 'formula') return { x: 360, y: 210 };
  if (element.elementType === 'labeled_step') return { x: 360, y: 835 };
  if (element.elementType === 'matrix') return { x: 570, y: 1030 };
  if (element.elementType === 'neural_node') return { x: 140 + element.layerIndex * 210, y: 1030 + element.nodeIndex * 90 };
  return { x: 70 + (index % 2) * 330, y: 190 + Math.floor(index / 2) * 150 };
};

const neuralPosition = (layerIndex: number, nodeIndex: number) => ({ x: 140 + layerIndex * 210, y: 1030 + nodeIndex * 90 });

export const VisualDslSceneV3: React.FC<{ definition: VisualSceneDefinitionV3 }> = ({ definition }) => {
  const supported = new Set<VisualElementV3['elementType']>([
    'text', 'formula', 'graph', 'axes', 'point', 'arrow', 'matrix', 'labeled_step', 'neural_node', 'neural_connection'
  ]);
  const unsupported = definition.elements.find((element) => !supported.has(element.elementType));
  if (unsupported) throw new Error(`Unsupported Visual DSL primitive: ${unsupported.elementType}`);
  const positions = new Map(definition.elements.map((element, index) => [element.elementId, positionOf(element, index)]));
  return <AbsoluteFill style={{ background: definition.style === 'math_chalkboard' ? '#102A22' : '#070B14', color: '#F8FAFC', fontFamily: 'Arial, sans-serif', overflow: 'hidden' }}>
    <svg width="720" height="1280" style={{ position: 'absolute', inset: 0 }}>
      {definition.elements.map((element) => {
        if (element.elementType === 'axes') return <g key={element.elementId} stroke={element.gridColor}><line x1="90" y1="720" x2="650" y2="720"/><line x1="120" y1="170" x2="120" y2="760"/></g>;
        if (element.elementType === 'graph') return <path key={element.elementId} d="M120 650 Q330 180 620 650" fill="none" stroke="#38BDF8" strokeWidth="5"/>;
        if (element.elementType === 'point') { const [x,y] = element.coordinates; return <circle key={element.elementId} cx={120+x*70} cy={720-y*70} r="9" fill={element.color}/>; }
        if (element.elementType === 'arrow') { const from=positions.get(element.fromElementId)!; const to=positions.get(element.toElementId)!; return <line key={element.elementId} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={element.color} strokeWidth="4"/>; }
        if (element.elementType === 'neural_connection') { const from=neuralPosition(element.fromLayer, element.fromNode); const to=neuralPosition(element.toLayer, element.toNode); return <line key={element.elementId} {...{x1:from.x,y1:from.y,x2:to.x,y2:to.y}} stroke={element.signalActive?'#22D3EE':'#475569'} strokeWidth="3"/>; }
        return null;
      })}
    </svg>
    {definition.elements.map((element, index) => {
      const pos = positions.get(element.elementId)!;
      const base: React.CSSProperties = { position:'absolute', left:pos.x, top:pos.y, transform:'translate(-50%,-50%)', zIndex:2 };
      if (element.elementType === 'text') return <div key={element.elementId} style={{...base,width:640,textAlign:'center',color:element.color,fontSize:element.typography==='heading_1'?46:26,fontWeight:700}}>{element.content}</div>;
      if (element.elementType === 'formula') return <div key={element.elementId} style={{...base,color:element.color,fontSize:element.fontSize,fontFamily:'serif',background:'rgba(15,23,42,.8)',padding:'14px 20px',borderRadius:14}}>{element.latex}</div>;
      if (element.elementType === 'matrix') return <div key={element.elementId} style={{...base,display:'grid',gridTemplateColumns:`repeat(${element.cols}, 55px)`,gap:5}}>{element.values.flat().map((value,i)=><span key={i} style={{padding:8,textAlign:'center',background:element.showHeatmap?`rgba(56,189,248,${Math.min(1,Math.abs(value))})`:'#1E293B'}}>{value}</span>)}</div>;
      if (element.elementType === 'labeled_step') return <div key={element.elementId} style={{...base,width:300,padding:14,border:'1px solid #38BDF8',borderRadius:12}}><b>{element.stepNumber}. {element.title}</b><div>{element.formula}</div><small>{element.explanation}</small></div>;
      if (element.elementType === 'neural_node') return <div key={element.elementId} style={{...base,width:62,height:62,borderRadius:'50%',display:'grid',placeItems:'center',background:element.state==='firing'?'#F59E0B':'#0EA5E9',border:'3px solid white'}}>{element.label??element.value??''}</div>;
      return null;
    })}
  </AbsoluteFill>;
};

