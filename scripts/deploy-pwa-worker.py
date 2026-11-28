import hashlib
import json
import os
import pathlib
import re
import struct
import subprocess
import sys
import time
import urllib.request

ROOT='/kansai'
SITE='https://kansai.rss7.net'
BRANCH='refs/heads/ops/pwa-sw-release-184'
assert os.environ.get('GITHUB_REF')==BRANCH
assert os.environ.get('GITHUB_ACTOR')=='oosaka0123-sudo'
target=pathlib.Path('sw.js').read_bytes()
assert hashlib.sha1(b'blob '+str(len(target)).encode()+b'\0'+target).hexdigest()=='3281ff6625aed4a726d4d4b5a79f90ddabe27c26'
backup=pathlib.Path(os.environ['RUNNER_TEMP'])/'ks-pwa-backup-sw.js'
user=os.environ['FTP_USER']
password=os.environ['FTP_PASS']
assert user and password and not any(x in user+password for x in '\r\n\0')
def quote(s):
    return '"'+str(s).replace('\\','\\\\').replace('"','\\"').replace('$','\\$').replace('\x60','\\\x60')+'"'
def ftp(cmd):
    commands=['set cmd:fail-exit true','set ftp:ssl-force true','set ftp:ssl-protect-data true','set ssl:verify-certificate true','set ftp:passive-mode true','set net:timeout 25','set net:max-retries 2','open -u '+quote(user)+','+quote(password)+' ftp.lolipop.jp',cmd,'bye','']
    r=subprocess.run(['lftp'],input='\n'.join(commands),text=True,capture_output=True,timeout=100)
    if r.returncode: raise RuntimeError('FTPS operation failed')
def get(path):
    sep='&' if '?' in path else '?'
    req=urllib.request.Request(SITE+path+sep+'pwa_verify='+str(time.time_ns()),headers={'Cache-Control':'no-cache','User-Agent':'KS-PWA-Release-Check/1'})
    with urllib.request.urlopen(req,timeout=25) as r:
        assert r.status==200 and r.geturl().startswith(SITE+'/')
        return r.read(),r.headers.get_content_type()
def canonical(data):
    # Only whole-line comments and whitespace are ignored. No code is stripped.
    return re.sub(r'\s+','',re.sub(r'(?m)^\s*//[^\n]*','',data.decode('utf-8-sig',errors='replace')))
def live_sw():
    data,mime=get('/sw.js')
    assert mime in ('text/javascript','application/javascript','application/x-javascript'),mime
    return data
def protected():
    m=json.loads(get('/manifest.json')[0])
    assert m==json.loads(pathlib.Path('manifest.json').read_text()),'live manifest differs'
    for icon in m['icons']:
        data,mime=get(icon['src'])
        assert mime=='image/png' and data[:8]==b'\x89PNG\r\n\x1a\n' and data[12:16]==b'IHDR'
        assert struct.unpack('>II',data[16:24])==tuple(map(int,icon['sizes'].split('x')))
    home,_=get(m['start_url'])
    assert b'/manifest.json' in home and b'serviceWorker' in home
    for spot in ['isonoura','kounohama','ikumi','komatsu','irago','shizunami','hamadutu','takahama','hakuto','ukibuchi','irino','futami','hirano','oki']:
        data,mime=get('/'+spot+'.html')
        assert mime=='text/html' and b'/manifest.json' in data,spot
    print('Live manifest, icon dimensions, start page and 14 pages verified',flush=True)
def preflight():
    protected()
    data=live_sw()
    expected=pathlib.Path('scripts/pwa-previous-worker.txt').read_bytes()
    assert data==target or canonical(data)==canonical(expected),'unexpected existing worker: stop'
    ftp('get '+quote(ROOT+'/sw.js')+' -o '+quote(backup))
    assert backup.read_bytes()==data,'FTP/public mismatch'
    print('Verified original worker backup',flush=True)
def publish():
    original=backup.read_bytes()
    assert live_sw()==original,'worker changed after preflight'
    if original==target:
        print('Already deployed; no write required',flush=True)
        return
    try:
        ftp('put '+quote(pathlib.Path('sw.js').resolve())+' -o '+quote(ROOT+'/sw.js'))
        assert live_sw()==target,'public digest mismatch'
        protected()
        print('Only sw.js published and verified',flush=True)
    except Exception:
        ftp('put '+quote(backup)+' -o '+quote(ROOT+'/sw.js'))
        assert live_sw()==original,'rollback verification failed'
        print('Original worker restored',flush=True)
        raise
if sys.argv[1]=='preflight':preflight()
elif sys.argv[1]=='publish':publish()
else:raise ValueError('invalid mode')
