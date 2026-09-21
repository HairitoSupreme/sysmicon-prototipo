/* Motor de la escena 3D que se arma con el scroll. Lo comparten el home y el portafolio.
   SysEscena({stage,track,canvas,labels,data,onUI,offset,fitK,textZone}) -> {gl,dispose} */
window.SysEscena=function(o){
  var stage=o.stage, track=o.track, canvas=o.canvas, labelsEl=o.labels, view=o.view||o.stage, OPT=o, alive=true, raf=0; // OPT: dentro de update() "o" es la opacidad de las etiquetas
  var CUTS=[0,.10,.26,.48,.68,.84,1.01];
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches, coarse=matchMedia('(pointer: coarse)').matches;
  var p=0, ps=0, mx=0, smx=0;
  var dbgM=/[#&]p=([\d.]+)/.exec(location.hash||''), dbgP=dbgM?parseFloat(dbgM[1]):null;

  function clamp01(x){return x<0?0:x>1?1:x;}
  function smooth(x){x=clamp01(x);return x*x*(3-2*x);}
  function lerp(a,b,t){return a+(b-a)*t;}

  function readScroll(){
    var r=track.getBoundingClientRect(), total=r.height-stage.clientHeight;
    p=total>0?clamp01(-r.top/total):0;
    if(dbgP!==null) p=dbgP; // #p=0.6 fija el avance (solo para revisar encuadres)
    return r.bottom>0 && r.top<innerHeight;
  }
  function setUI(done,total){ var idx=0; for(var i=0;i<6;i++){ if(ps>=CUTS[i]) idx=i; } if(o.onUI) o.onUI({ps:ps,idx:idx,done:done,total:total}); }

  var gl=null;
  try{ if(window.THREE) gl=initGL(); }catch(e){ gl=null; if(window.console) console.error(e); }
  if(!gl) stage.classList.add('nogl');

  function onMove(e){mx=(e.clientX/innerWidth)*2-1;}
  addEventListener('pointermove',onMove,{passive:true});

  // Render bajo demanda: solo se dibuja cuando cambia el scroll, el mouse o el tamaño.
  var lastT=0, lastKey='', done=0, total=0, wasDirty=false, slowSum=0, slowN=0, lowered=false;
  function frame(t){
    if(!alive) return;
    var dt=Math.min(.05,(t-lastT)/1000); lastT=t;
    var vis=readScroll();
    ps = reduce ? p : ps+(p-ps)*(1-Math.exp(-dt*16));
    if(Math.abs(p-ps)<0.0004) ps=p;
    smx+=(mx-smx)*(1-Math.exp(-dt*6)); if(Math.abs(mx-smx)<0.002) smx=mx;
    var key=ps.toFixed(5)+'|'+smx.toFixed(3)+'|'+view.clientWidth+'x'+view.clientHeight;
    var dirty=key!==lastKey && vis;
    if(dirty){
      lastKey=key;
      if(gl){ var r=gl.update(ps,smx); done=r[0]; total=r[1]; }
      setUI(done,total);
      // calidad adaptativa: si el equipo no da 40 fps mientras se hace scroll, baja resolución y sombras
      if(gl && wasDirty && !lowered){ slowSum+=dt; slowN++; if(slowN>=40){ if(slowSum/slowN>.025){gl.lower();lowered=true;lastKey='';} slowSum=0;slowN=0; } }
    }
    wasDirty=dirty;
    raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);

  function initGL(){
    var D=o.data; if(!D) return null;
    var T=THREE, BG=0x070d15, AMBER=0xf2b33d;
    var renderer=new T.WebGLRenderer({canvas:canvas,antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1, coarse?1.25:1.5));
    renderer.setClearColor(BG,1);
    renderer.outputEncoding=T.sRGBEncoding;
    renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
    var shadows=!coarse;
    renderer.shadowMap.enabled=shadows; renderer.shadowMap.type=T.PCFSoftShadowMap;

    var scene=new T.Scene(); scene.fog=new T.Fog(BG,80,240);
    var camera=new T.PerspectiveCamera(32,1,0.5,900);

    var hemi=new T.HemisphereLight(0xbfd9f2,0x0a1420,0.5); scene.add(hemi);
    var sun=new T.DirectionalLight(0xffffff,0.95); sun.position.set(-22,42,34);
    sun.castShadow=shadows; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0008; sun.shadow.normalBias=0.04;
    var BB=D.bbox, EXT=Math.max(BB[2]-BB[0],BB[3]-BB[1]), CXs=(BB[0]+BB[2])/2, CZs=(BB[1]+BB[3])/2;
    sun.position.set(CXs-EXT*.45,EXT*.85,CZs+EXT*.7); sun.target.position.set(CXs,0,CZs); scene.add(sun.target);
    var sc=sun.shadow.camera, sh=EXT*.72; sc.left=-sh;sc.right=sh;sc.top=sh;sc.bottom=-sh;sc.near=1;sc.far=EXT*3;
    scene.add(sun);
    var rim=new T.DirectionalLight(0x6fa3d4,0.45); rim.position.set(30,18,-28); scene.add(rim);
    var warm=new T.PointLight(0xffc36b,0,48,2); warm.position.set(0,2.2,8); scene.add(warm);

    var ground=new T.Mesh(new T.PlaneGeometry(900,900), new T.MeshStandardMaterial({color:0x07101a,roughness:1,metalness:0}));
    ground.rotation.x=-Math.PI/2; ground.position.y=-0.12; ground.receiveShadow=shadows; scene.add(ground);
    var grid=new T.GridHelper(400,200,0x2f5a84,0x16304a); grid.position.y=-0.11;
    grid.material.transparent=true; grid.material.opacity=0.5; grid.material.depthWrite=false; scene.add(grid);

    if(D.lot){
      var l=D.lot, lp=[[l[0],l[1]],[l[2],l[1]],[l[2],l[3]],[l[0],l[3]],[l[0],l[1]]].map(function(a){return new T.Vector3(a[0],-0.08,a[1]);});
      var lotLine=new T.Line(new T.BufferGeometry().setFromPoints(lp),
        new T.LineDashedMaterial({color:AMBER,dashSize:1.2,gapSize:.8,transparent:true,opacity:.6}));
      lotLine.computeLineDistances(); scene.add(lotLine);
    }

    /* ---- Casa El Legado: 2 mallas, cada pieza de Revit animada en el vertex shader ---- */
    function dec(s,Ty){var bin=atob(s),n=bin.length,u=new Uint8Array(n);for(var i=0;i<n;i++)u[i]=bin.charCodeAt(i);return new Ty(u.buffer);}
    var S=D.q.scale, QM=D.q.min;
    var U={uP:{value:0},uDur:{value:D.dur},uFin:{value:0},uGlow:{value:new T.Color(AMBER)},
      uFrom:{value:[[0,0,0],[0,-2.5,0],[0,6,0],[0,10,0],[0,9,0],[0,3,0]].map(function(a){return new T.Vector3(a[0]/S,a[1]/S,a[2]/S);})}};
    var VPARS='attribute vec3 aCen;attribute vec2 aAnim;uniform float uP;uniform float uDur;uniform vec3 uFrom[6];varying float vK;varying float vR;\n';
    var VMAIN='#include <begin_vertex>\n float k_=clamp((uP-aAnim.x)/uDur,0.,1.);float e_=1.-pow(1.-k_,3.);int s_=int(aAnim.y*8.+.5);\n'+
              ' transformed=aCen+(transformed-aCen)*e_+uFrom[s_]*(1.-e_);vK=k_;\n'+
              ' vR=fract(sin(dot(aCen.xz,vec2(12.9898,78.233))*40.)*43758.5453);\n'; // azar estable por pieza: las ventanas no se prenden todas a la vez
    function patch(mat,glass){
      // sin esta llave three reutiliza el mismo programa para opaco y vidrio (el código de onBeforeCompile es idéntico en texto)
      mat.customProgramCacheKey=function(){return glass?'legado-glass':'legado-opaque';};
      mat.onBeforeCompile=function(sh){
        sh.uniforms.uP=U.uP; sh.uniforms.uDur=U.uDur; sh.uniforms.uFrom=U.uFrom; sh.uniforms.uFin=U.uFin; sh.uniforms.uGlow=U.uGlow;
        sh.vertexShader=VPARS+sh.vertexShader.replace('#include <begin_vertex>',VMAIN);
        if(sh.fragmentShader.indexOf('<emissivemap_fragment>')>-1){
          sh.fragmentShader='uniform float uFin;uniform vec3 uGlow;varying float vK;varying float vR;\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>',
            '#include <emissivemap_fragment>\n totalEmissiveRadiance+=uGlow*(1.-vK)*step(.001,vK)*.8;\n'+
            // ventanas (vidrio claro) se encienden en amarillo cálido, una por una; el agua solo gana un brillo azul
            (glass?' float win_=step(.4,vColor.r);float on_=smoothstep(vR*.55,vR*.55+.4,uFin)*win_;\n'+
                   ' totalEmissiveRadiance+=vec3(1.,.56,.13)*on_*mix(.85,1.35,vR)+vColor.rgb*.6*uFin*(1.-win_);\n'+
                   ' diffuseColor.rgb*=1.-on_*.9; diffuseColor.a=mix(diffuseColor.a,.97,on_);\n':''));
        }
      };
      return mat;
    }
    function build(d,glass){
      var g=new T.BufferGeometry();
      g.setAttribute('position',new T.BufferAttribute(dec(d.pos,Uint16Array),3,true));
      g.setAttribute('aCen',new T.BufferAttribute(dec(d.cen,Uint16Array),3,true));
      g.setAttribute('color',new T.BufferAttribute(dec(d.col,Uint8Array),4,true));
      g.setAttribute('aAnim',new T.BufferAttribute(dec(d.anim,Uint16Array),2,true));
      g.setIndex(new T.BufferAttribute(dec(d.idx,Uint32Array),1));
      var m=new T.Mesh(g,patch(new T.MeshStandardMaterial(glass?
        {vertexColors:true,flatShading:true,transparent:true,opacity:.42,roughness:.1,metalness:.3,depthWrite:false,side:T.DoubleSide}:
        {vertexColors:true,flatShading:true,roughness:.78,metalness:.08,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,side:T.DoubleSide}),glass));
      m.scale.setScalar(S); m.position.set(QM[0],QM[1],QM[2]); m.frustumCulled=false;
      if(!glass&&shadows){ m.castShadow=true; m.receiveShadow=true;
        m.customDepthMaterial=patch(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide}),false); }
      scene.add(m); return m;
    }
    var opaque=build(D.opaque,false), glassM=build(D.glass,true);

    // plano fantasma: aristas de toda la casa en una sola geometría de líneas
    var ghostMat=new T.LineBasicMaterial({color:0x6fa3d4,transparent:true,opacity:.3,depthWrite:false});
    (function(){
      var src=opaque.geometry.attributes.position.array, f=new Float32Array(src.length);
      for(var i=0;i<src.length;i++) f[i]=src[i]/65535;
      var tmp=new T.BufferGeometry(); tmp.setAttribute('position',new T.BufferAttribute(f,3)); tmp.setIndex(opaque.geometry.index);
      var eg=new T.EdgesGeometry(tmp,28), ln=new T.LineSegments(eg,ghostMat);
      ln.scale.setScalar(S); ln.position.copy(opaque.position); ln.frustumCulled=false; scene.add(ln);
    })();

    /* ---- paisajismo: césped, árboles y luces de jardín que aparecen con los acabados ---- */
    var land=(function(){
      var l=D.lot||[BB[0]-6,BB[1]-6,BB[2]+6,BB[3]+6], M=24, X0=l[0]-M, Z0=l[1]-M, GW=Math.ceil(l[2]-l[0]+2*M), GH=Math.ceil(l[3]-l[1]+2*M);
      // huella de la casa en una grilla de 1 m (triángulos rasterizados en planta) + distancia a la huella
      var dist=new Float32Array(GW*GH); for(var i=0;i<dist.length;i++) dist[i]=1e4;
      [opaque,glassM].forEach(function(m){
        var a=m.geometry.attributes.position.array, ix=m.geometry.index.array, k=S/65535;
        for(var t=0;t<ix.length;t+=3){
          var ax=a[ix[t]*3]*k+QM[0]-X0, az=a[ix[t]*3+2]*k+QM[2]-Z0, bx=a[ix[t+1]*3]*k+QM[0]-X0, bz=a[ix[t+1]*3+2]*k+QM[2]-Z0,
              cx=a[ix[t+2]*3]*k+QM[0]-X0, cz=a[ix[t+2]*3+2]*k+QM[2]-Z0;
          var i0=Math.max(0,Math.floor(Math.min(ax,bx,cx))), i1=Math.min(GW-1,Math.floor(Math.max(ax,bx,cx))),
              j0=Math.max(0,Math.floor(Math.min(az,bz,cz))), j1=Math.min(GH-1,Math.floor(Math.max(az,bz,cz)));
          var det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz), flat=Math.abs(det)<.05;
          for(var j=j0;j<=j1;j++) for(var i=i0;i<=i1;i++){
            if(flat){ if((i1-i0)+(j1-j0)<3) dist[j*GW+i]=0; continue; }
            var u=((bz-cz)*(i+.5-cx)+(cx-bx)*(j+.5-cz))/det, v=((cz-az)*(i+.5-cx)+(ax-cx)*(j+.5-cz))/det;
            if(u>=-.02&&v>=-.02&&u+v<=1.02) dist[j*GW+i]=0;
          }
          [[ax,az],[bx,bz],[cx,cz]].forEach(function(q){var i=Math.floor(q[0]),j=Math.floor(q[1]); if(i>=0&&j>=0&&i<GW&&j<GH) dist[j*GW+i]=0;});
        }
      });
      function relax(i,j,di,dj,c){ var ii=i+di,jj=j+dj; if(ii<0||jj<0||ii>=GW||jj>=GH) return; var v=dist[jj*GW+ii]+c; if(v<dist[j*GW+i]) dist[j*GW+i]=v; }
      for(var j=0;j<GH;j++) for(var i=0;i<GW;i++){ relax(i,j,-1,0,1); relax(i,j,0,-1,1); relax(i,j,-1,-1,1.414); relax(i,j,1,-1,1.414); }
      for(var j=GH-1;j>=0;j--) for(var i=GW-1;i>=0;i--){ relax(i,j,1,0,1); relax(i,j,0,1,1); relax(i,j,1,1,1.414); relax(i,j,-1,1,1.414); }
      function dAt(x,z){ var i=Math.floor(x-X0), j=Math.floor(z-Z0); return (i<0||j<0||i>=GW||j>=GH)?1e4:dist[j*GW+i]; }
      function edge(x,z){ return Math.min(x-l[0],l[2]-x,z-l[1],l[3]-z); }

      var seed=20260921; function rnd(){ seed|=0; seed=seed+0x6D2B79F5|0; var t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }
      function hash(i,j){ var s=Math.sin(i*127.1+j*311.7)*43758.5453; return s-Math.floor(s); }
      function noise(x,z){ var i=Math.floor(x),j=Math.floor(z),fx=smooth(x-i),fz=smooth(z-j);
        return lerp(lerp(hash(i,j),hash(i+1,j),fx),lerp(hash(i,j+1),hash(i+1,j+1),fx),fz); }

      // césped: se disuelve hacia afuera del lote para que el plano técnico siga mandando alrededor
      var GM=20, gw=l[2]-l[0]+2*GM, gh=l[3]-l[1]+2*GM;
      var gg=new T.PlaneGeometry(gw,gh,Math.round(gw/2.5),Math.round(gh/2.5)); gg.rotateX(-Math.PI/2); gg.translate((l[0]+l[2])/2,-0.09,(l[1]+l[3])/2);
      var gp=gg.attributes.position, gc=new Float32Array(gp.count*4);
      for(var i=0;i<gp.count;i++){
        var x=gp.getX(i), z=gp.getZ(i), n=noise(x*.09,z*.09)*.65+noise(x*.31,z*.31)*.35;
        gc[i*4]=lerp(.055,.115,n); gc[i*4+1]=lerp(.16,.27,n); gc[i*4+2]=lerp(.095,.115,n);
        gc[i*4+3]=smooth((edge(x,z)+18)/12+(noise(x*.14+9,z*.14)-.5)*.5);
      }
      gg.setAttribute('color',new T.BufferAttribute(gc,4));
      var grassMat=new T.MeshStandardMaterial({vertexColors:true,transparent:true,opacity:0,roughness:1,metalness:0,depthWrite:false});
      var grass=new T.Mesh(gg,grassMat); grass.receiveShadow=shadows; grass.renderOrder=-1; grass.visible=false; scene.add(grass);

      // altura máxima de un árbol para no tapar la casa desde el encuadre final (cámara a ~13° sobre el horizonte)
      var cdx=Math.sin(.38), cdz=Math.cos(.38);
      function clearH(x,z){ for(var t=2;t<90;t++){ if(dAt(x-cdx*t,z-cdz*t)<2.5) return .6+t*.2; } return 99; }
      function far(list,x,z,min){ for(var i=0;i<list.length;i++){ var dx=list[i].x-x,dz=list[i].z-z; if(dx*dx+dz*dz<min*min) return false; } return true; }

      var trees=[], shrubs=[], lamps=[];
      for(var n=0;n<4000&&trees.length<110;n++){
        var x=lerp(l[0]-20,l[2]+20,rnd()), z=lerp(l[1]-20,l[3]+20,rnd()), d=dAt(x,z), e=edge(x,z);
        if(d<3.4 || rnd()>(e<0?.3:e<9?.9:.2) || !far(trees,x,z,e<0?5.5:3.8)) continue;
        var h=Math.min(lerp(3.6,8.5,Math.pow(rnd(),1.4)),clearH(x,z));
        // a la izquierda del encuadre va el titular: ahí solo arbolitos bajos y pocos, para que el texto se lea
        if(o.textZone!==false && (x-CXs)*cdz-(z-CZs)*cdx<-12 && (x-CXs)*cdx+(z-CZs)*cdz>-14){ if(rnd()>.35) continue; h=Math.min(h,3); }
        if(h<2.4) continue;
        trees.push({x:x,z:z,h:h,cone:rnd()<.22,rot:rnd()*6.28,sx:lerp(.85,1.2,rnd()),dl:clamp01(d/70)*.35+rnd()*.25,c:rnd()});
      }
      for(var n=0;n<6000&&shrubs.length<80;n++){
        var x=lerp(l[0],l[2],rnd()), z=lerp(l[1],l[3],rnd()), d=dAt(x,z);
        if(d<1.3 || (d>2.8&&rnd()>.04) || !far(shrubs,x,z,1.5) || !far(trees,x,z,1.8)) continue;
        shrubs.push({x:x,z:z,h:lerp(.45,1,rnd()),rot:rnd()*6.28,sx:lerp(.9,1.5,rnd()),dl:rnd()*.4,c:rnd()});
      }
      for(var n=0;n<6000&&lamps.length<20;n++){
        var x=lerp(l[0],l[2],rnd()), z=lerp(l[1],l[3],rnd()), d=dAt(x,z);
        if(d<2.4 || d>3.6 || !far(lamps,x,z,7) || !far(shrubs,x,z,.9)) continue;
        lamps.push({x:x,z:z,dl:rnd()*.5});
      }

      // copa de maqueta: tres icosaedros fundidos en una sola geometría
      function blob(){
        var parts=[[0,0,0,1],[.62,-.18,.2,.68],[-.5,-.1,-.38,.74],[.05,.5,-.1,.6]], arrs=[], len=0;
        parts.forEach(function(q){ var g=new T.IcosahedronGeometry(q[3],1); g.translate(q[0],q[1],q[2]); var a=(g.index?g.toNonIndexed():g).attributes.position.array; arrs.push(a); len+=a.length; });
        var f=new Float32Array(len), o=0; arrs.forEach(function(a){f.set(a,o);o+=a.length;});
        var g=new T.BufferGeometry(); g.setAttribute('position',new T.BufferAttribute(f,3)); g.computeVertexNormals(); return g;
      }
      var GREENS=[0x2f6b47,0x285a40,0x3f7a4a,0x1f4d3b,0x4f874a], col=new T.Color(), dm=new T.Object3D();
      function inst(geo,mat,n,cast){ var m=new T.InstancedMesh(geo,mat,Math.max(1,n)); m.count=n; m.frustumCulled=false; m.castShadow=cast&&shadows; m.receiveShadow=shadows; m.visible=false; scene.add(m); return m; }
      var leaf=new T.MeshStandardMaterial({color:0xffffff,flatShading:true,roughness:.95,metalness:0});
      var round=trees.filter(function(t){return !t.cone;}), cones=trees.filter(function(t){return t.cone;});
      var trunkG=new T.CylinderGeometry(.6,1,1,5); trunkG.translate(0,.5,0);
      var coneG=new T.ConeGeometry(1,1,6); coneG.translate(0,.5,0);
      var mTrunk=inst(trunkG,new T.MeshStandardMaterial({color:0x4a3c33,flatShading:true,roughness:1}),trees.length,true),
          mRound=inst(blob(),leaf,round.length,true), mCone=inst(coneG,leaf,cones.length,true), mShrub=inst(blob(),leaf,shrubs.length,false);
      function tint(m,list,dark){ list.forEach(function(t,i){ col.setHex(GREENS[Math.floor(t.c*GREENS.length)%GREENS.length]); if(dark) col.multiplyScalar(.78); m.setColorAt(i,col); }); if(m.instanceColor) m.instanceColor.needsUpdate=true; }
      tint(mRound,round,false); tint(mCone,cones,true); tint(mShrub,shrubs,false);

      var glowG=new T.PlaneGeometry(5,5); glowG.rotateX(-Math.PI/2);
      var cv=document.createElement('canvas'); cv.width=cv.height=64; var cx2=cv.getContext('2d'), gr=cx2.createRadialGradient(32,32,0,32,32,32);
      gr.addColorStop(0,'rgba(255,176,70,1)'); gr.addColorStop(.35,'rgba(255,160,50,.35)'); gr.addColorStop(1,'rgba(255,150,40,0)'); cx2.fillStyle=gr; cx2.fillRect(0,0,64,64);
      var bulbMat=new T.MeshBasicMaterial({color:0xffd27a}), glowMat=new T.MeshBasicMaterial({map:new T.CanvasTexture(cv),transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false});
      var mBulb=inst(new T.SphereGeometry(.17,8,6),bulbMat,lamps.length,false), mGlow=inst(glowG,glowMat,lamps.length,false);
      mGlow.receiveShadow=false; mBulb.receiveShadow=false;

      function grow(v,dl){ var t=clamp01((v-dl)/.4)-1; return 1+2.2*t*t*t+1.2*t*t; } // sale del piso con un pequeño rebote
      function put(m,i,x,y,z,sx,sy,sz,rot){ dm.position.set(x,y,z); dm.scale.set(sx||1e-4,sy||1e-4,sz||1e-4); dm.rotation.set(0,rot,0); dm.updateMatrix(); m.setMatrixAt(i,dm.matrix); }
      var last=-1, Y=-0.09;
      function set(v,fin){
        if(v===last) return; last=v;
        var on=v>0; grass.visible=mTrunk.visible=mRound.visible=mCone.visible=mShrub.visible=mBulb.visible=mGlow.visible=on; if(!on) return;
        grassMat.opacity=smooth(v*2.2); glowMat.opacity=fin*.7;
        var ri=0, ci=0;
        trees.forEach(function(t,i){
          var s=grow(v,t.dl), h=t.h*s, w=(t.h*.028+.07)*s;
          if(t.cone){ put(mTrunk,i,t.x,Y,t.z,w,h*.2,w,t.rot); put(mCone,ci++,t.x,Y+h*.14,t.z,h*.17*t.sx,h*.86,h*.17*t.sx,t.rot); }
          else { var r=h*.3; put(mTrunk,i,t.x,Y,t.z,w,h*.55,w,t.rot); put(mRound,ri++,t.x,Y+h*.48+r*.62,t.z,r*t.sx,r*.92,r*t.sx,t.rot); }
        });
        shrubs.forEach(function(t,i){ var r=t.h*grow(v,t.dl); put(mShrub,i,t.x,Y+r*.55,t.z,r*t.sx,r*.8,r*t.sx,t.rot); });
        lamps.forEach(function(t,i){ var s=grow(v,.45+t.dl); put(mBulb,i,t.x,Y+.55*s,t.z,s,s,s,0); put(mGlow,i,t.x,Y+.02,t.z,s,1,s,0); });
        [mTrunk,mRound,mCone,mShrub,mBulb,mGlow].forEach(function(m){m.instanceMatrix.needsUpdate=true;});
      }
      return {set:set};
    })();

    /* ---- callouts con los nombres reales del modelo ---- */
    var L=(D.labels||[]).map(function(l){return {p:l.p,t:l.t,r:l.r,dim:l.dim};});
    L.forEach(function(l){
      var d=document.createElement('div'); d.className='lab mono'+(l.dim?' dim':'');
      d.innerHTML='<i></i><span><b>'+l.t+'</b></span>'; labelsEl.appendChild(d); l.el=d; l.v=new T.Vector3(l.p[0],l.p[1],l.p[2]); l.o=-1;
    });

    var T1=D.t1, total=T1.length;
    function doneCount(x){var lo=0,hi=total;while(lo<hi){var mid=(lo+hi)>>1;if(T1[mid]<=x)lo=mid+1;else hi=mid;}return lo;}

    var w=0,h=0,asp=1,tmp=new T.Vector3(),target=new T.Vector3();
    function resize(){
      var nw=view.clientWidth,nh=view.clientHeight; if(nw===w&&nh===h) return; w=nw;h=nh;asp=w/h;
      renderer.setSize(w,h,false); camera.aspect=asp;
      var off=o.offset?o.offset(w,h,asp):(asp>1.15?[-w*.1,-h*.04]:[0,h*.18]); camera.setViewOffset(w,h,off[0],off[1],w,h);
      L.forEach(function(l){l.hw=l.el.lastChild.offsetWidth/2;});
      camera.updateProjectionMatrix();
    }

    function update(ps,smx){
      resize();
      var fin=smooth((ps-.9)/.09);
      U.uP.value=ps; U.uFin.value=fin;
      ghostMat.opacity=lerp(.3,.12,fin);
      land.set(smooth((ps-.885)/.1),fin);
      // al final cae la tarde: baja el sol y sube la luz cálida, para que las ventanas encendidas manden
      warm.intensity=fin*3.2; hemi.intensity=.5-fin*.24; sun.intensity=.9-fin*.55; rim.intensity=.45+fin*.25;

      var ea=smooth(ps), th=lerp(-.75,.38,ea)+smx*.06;
      var fit=Math.max(1,(OPT.fitK||1.55)/asp), r=lerp(1.7,1.4,ea)*EXT*fit, hy=lerp(.74,.33,ea)*EXT*Math.sqrt(fit);
      camera.position.set(CXs+Math.sin(th)*r,hy,CZs+Math.cos(th)*r);
      target.set(CXs,lerp(.5,1.6,ea),CZs+lerp(-.04,.06,ea)*EXT); camera.lookAt(target);
      scene.fog.near=r*1.2; scene.fog.far=r*3.6;
      renderer.render(scene,camera);

      for(var j=0;j<L.length;j++){
        var l=L[j], o=smooth((ps-l.r[0])/.015)*(1-smooth((ps-l.r[1])/.015));
        if(o>0){ tmp.copy(l.v).project(camera); if(tmp.z>1) o=0;
          else { var lx=(tmp.x*.5+.5)*w;
            if(l.dim) lx=Math.max(l.hw+8,Math.min(w-l.hw-8,lx)); // la placa centrada no se sale del borde
            else { var fl=lx+l.hw*2+20>w; if(fl!==l.fl){l.fl=fl;l.el.classList.toggle('flip',fl);} // cerca del borde derecho el texto sale hacia la izquierda
              var sh=fl?Math.max(0,Math.round(18-(lx-10-l.hw*2))):0; if(sh!==l.sh){l.sh=sh;l.el.lastChild.style.marginRight=-sh+'px';} } // y en pantallas angostas no se sale por la izquierda
            l.el.style.transform='translate('+lx.toFixed(1)+'px,'+((-tmp.y*.5+.5)*h).toFixed(1)+'px)'; } }
        if(o!==l.o){l.o=o;l.el.style.opacity=o.toFixed(3);}
      }
      return [doneCount(ps),total];
    }
    function lower(){ sun.castShadow=false; opaque.castShadow=false; renderer.setPixelRatio(1); w=0; }
    function dispose(){ L.forEach(function(l){ if(l.el.parentNode) l.el.parentNode.removeChild(l.el); });
      scene.traverse(function(n){ if(n.geometry) n.geometry.dispose(); if(n.material){ if(n.material.map) n.material.map.dispose(); n.material.dispose(); } }); renderer.dispose(); }
    return {update:update,lower:lower,dispose:dispose};
  }
  return {gl:!!gl, dispose:function(){ alive=false; cancelAnimationFrame(raf); removeEventListener('pointermove',onMove); if(gl) gl.dispose(); }};
};
