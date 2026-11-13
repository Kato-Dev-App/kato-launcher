"""Original progressive trance cue: 'Umbral', 136 BPM, D minor, 30 seconds."""
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io.wavfile import write
SR=44100; DUR=30; N=SR*DUR; B=60/136
rng=np.random.default_rng(20261112)
drums=np.zeros((N,2));bass=np.zeros((N,2));music=np.zeros((N,2));air=np.zeros((N,2))
def filt(x,hz,kind='lowpass',order=2):return sosfilt(butter(order,hz,kind,fs=SR,output='sos'),x,axis=0)
def env(n,attack=.008,release=.04):
 e=np.ones(n);a=min(int(attack*SR),n);r=min(int(release*SR),n-a);e[:a]=np.linspace(0,1,a);e[-r:]=np.linspace(1,0,r) if r else e[-r:];return e

def put(track,start,sig,gain=1,pan=0):
 i=round(start*SR);sig=sig[:max(0,N-i)]
 if not len(sig):return
 if sig.ndim==1:sig=np.column_stack([sig*np.sqrt((1-pan)/2),sig*np.sqrt((1+pan)/2)])
 track[i:i+len(sig)]+=sig*gain

def supersaw(midi,duration,brightness=.8):
 n=int(duration*SR);t=np.arange(n)/SR;f=440*2**((midi-69)/12);out=np.zeros((n,2))
 for j,cents in enumerate([-19,-11,-5,0,5,11,19]):
  ff=f*2**(cents/1200);phase=rng.random()*2*np.pi;s=np.zeros(n)
  for h in range(1,min(24,int(16000/ff))+1):s+=np.sin(2*np.pi*ff*h*t+phase*h)*(brightness**(h/3))/h
  pan=(j-3)/3*.85;out[:,0]+=s*np.sqrt((1-pan)/2);out[:,1]+=s*np.sqrt((1+pan)/2)
 return out/6

def kick():
 t=np.arange(int(.44*SR))/SR;phase=2*np.pi*(48*t+115*.022*(1-np.exp(-t/.022)))
 s=np.sin(phase)*np.exp(-t*10)+filt(rng.standard_normal(len(t)),6000,'highpass')*.08*np.exp(-t*170)
 return np.tanh(s*1.8)*env(len(t),.001,.04)
K=kick()
def hat(opened=False):
 d=.20 if opened else .055;t=np.arange(int(d*SR))/SR
 return filt(rng.standard_normal(len(t)),8500,'highpass')*np.exp(-t*(22 if opened else 90))*env(len(t),.001,.01)*.14

def clap():
 t=np.arange(int(.25*SR))/SR;noise=filt(filt(rng.standard_normal(len(t)),1100,'highpass'),7000)
 e=sum(np.where(t>=s,np.exp(-np.maximum(t-s,0)*95),0) for s in [0,.011,.023])*.5+np.exp(-t*17)*.28
 return noise*e*.37
# 17 bars. Intro 0-4, build 4-6, drop 6-14, final phrase 14-16, resolution 16.
roots=[38,34,41,36];chords=[[62,65,69],[58,62,65],[60,65,69],[60,64,67]]
for bar in range(17):
 at=bar*4*B;root=roots[bar%4];notes=chords[bar%4];isdrop=6<=bar<16
 for beat in range(4):
  t=at+beat*B
  if bar<4 or isdrop:put(drums,t,K,.72)
  if (bar>=2 and bar<4 or isdrop) and beat%2:put(drums,t,clap(),.7)
  if bar>=2 and bar<16:
   put(drums,t+B/2,hat(True),.7,.35)
   for k in [0,1,3]:put(drums,t+k*B/4,hat(),.55,-.4 if k%2 else .2)
  if bar<16:
   for k in [1,2,3]:
    d=B/4*.92;n=int(d*SR);tt=np.arange(n)/SR;f=440*2**((root-69)/12)
    sig=np.sin(2*np.pi*f*tt)+.24*np.sin(4*np.pi*f*tt)+.1*np.sin(6*np.pi*f*tt)
    put(bass,t+k*B/4,sig*env(n,.003,.02),.29 if isdrop else .18)
 # Sustained, widening harmonic bed.
 for m in notes:
  d=4*B+.3;sig=supersaw(m,d,.5 if bar<4 else .72)*env(int(d*SR),.22,.4)[:,None]
  put(music,at,sig,.095 if isdrop else .14)
 # Plucked 16th arpeggio, progressive opening through the build.
 if bar<16:
  for k in range(16):
   d=.24;m=notes[[0,1,2,1,0,2,1,2][k%8]]+12
   brightness=.3+.5*min(bar/6,1);sig=supersaw(m,d,brightness)
   e=env(len(sig),.003,.025)*np.exp(-np.arange(len(sig))/SR*18)
   put(music,at+k*B/4,sig*e[:,None],.075 if isdrop else .10)
# A singable four-bar motif, played twice with a changed final cadence.
phrases=[[(0,74,1.5),(1.5,77,.5),(2,81,1),(3,79,.75)],[(0,77,2),(2.5,74,.5),(3,72,.75)],[(0,72,1),(1,77,1),(2,81,1.5)],[(0,79,1.5),(1.5,77,.5),(2,76,1),(3,72,.75)]]
for bar in range(6,16):
 for beat,m,length in phrases[(bar-6)%4]:
  d=length*B;sig=supersaw(m,d,.96)*env(int(d*SR),.012,.06)[:,None]
  put(music,bar*4*B+beat*B,sig,.28)
# Noise rise, snare acceleration, small silence before the drop.
for bar in [4,5]:
 for k in range(8 if bar==4 else 16):
  count=8 if bar==4 else 16;put(drums,bar*4*B+k*4*B/count,clap(),.15+.3*k/count)
rise_start=16*B;rise_len=8*B;n=int(rise_len*SR);tt=np.arange(n)/SR
noise=filt(rng.standard_normal(n),4000,'highpass')
put(air,rise_start,noise*(tt/rise_len)**2*.10)
for at in [24*B,40*B,56*B,64*B]:
 n=int(1.2*SR);tt=np.arange(n)/SR;put(air,at,filt(rng.standard_normal(n),6500,'highpass')*np.exp(-tt*4)*.13)
for m in [50,62,65,69,74]:
 d=30-64*B;sig=supersaw(m,d,.7)*env(int(d*SR),.015,.55)[:,None];put(music,64*B,sig,.16)
put(drums,64*B,K,.8)
# Stereo tempo echo and diffuse reverb, on music only.
wet=np.zeros_like(music)
for seconds,g in [(B*.75,.22),(B*1.5,.11),(B*2.25,.055),(.073,.055),(.109,.05),(.163,.043),(.227,.035),(.311,.025)]:
 sh=int(seconds*SR);wet[sh:]+=music[:-sh,::-1]*g
music+=filt(wet,6500)
# Pump synth layers against each four-on-the-floor kick, not the drums.
t=np.arange(N)/SR;phase=(t%B)/B;duck=.28+.72*(1-np.exp(-phase*6))
active=((t<16*B)|((t>=24*B)&(t<64*B)))
music*=np.where(active,duck,1)[:,None]
mix=drums+bass+music+air
# A short intake of breath before the lead enters.
a=int((24*B-.09)*SR);z=int(24*B*SR);mix[a:z]*=np.linspace(1,.03,z-a)[:,None]
mix=filt(mix,27,'highpass');mix=np.tanh(mix*1.25)
mix*=np.minimum(1,np.minimum(t/.005,(30-t)/.12))[:,None]
mix*=.89/np.max(np.abs(mix))
write(Path(__file__).parent/'umbral-trance.wav',SR,(mix*32767).astype(np.int16))
print('Wrote Umbral: 30 seconds, stereo, 136 BPM, D minor.')
