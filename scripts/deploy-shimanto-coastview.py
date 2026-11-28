import os,sys,pathlib,subprocess,hashlib,time,json
from pathlib import Path
SITE='https://kansai.rss7.net'
ROOT='/kansai'
HOST='ftp.lolipop.jp'
BASE='28df7d6b6b1476abcc67ff4e2d489610490ac504'
SOURCE='089fcf1e7954e33787123243260b2a165c9a9b07'
old=[s+'.html' for s in ['ukibuchi','irino','futami','hirano','oki']]
new=[]
home_hash='9fbafddc3ef123952ee14584683672d843e19d782e6a595a079b2083d6290e50'
home_after='4b82f4103f68e0c3b3f009d878230b5fd05ea4e9a30904b8e51c049a838b1906'
tmp=Path(os.environ['RUNNER_TEMP'])/'shimanto-release'
backup=tmp/'backup'
stage=tmp/'stage'
for x in [backup,stage]:x.mkdir(parents=True,exist_ok=True)
assert os.environ['GITHUB_REF']=='refs/heads/ops/shimanto-coastview-178'
assert os.environ['GITHUB_ACTOR']=='oosaka0123-sudo'
user,password=os.environ['FTP_USER'],os.environ['FTP_PASS']
assert user and password and not any(c in user+password for c in '\r\n\x00')
def sha(b):return hashlib.sha256(b).hexdigest()
def q(v):return '"'+str(v).replace('\\','\\\\').replace('"','\\"').replace('$','\\$').replace('`','\\`')+'"'
def ftp(commands):
    body='\n'.join(['set cmd:fail-exit true','set ftp:ssl-force true','set ftp:ssl-protect-data true','set ssl:verify-certificate true','set ftp:passive-mode true','set net:timeout 25','set net:max-retries 2','open -u '+q(user)+','+q(password)+' '+HOST]+commands+['bye',''])
    r=subprocess.run(['lftp'],input=body,text=True,capture_output=True)
    if r.returncode:raise RuntimeError('FTPS operation failed; credentials suppressed')
    return r.stdout
def http(p):
    r=subprocess.run(['curl','-fsSL','--retry','2','--max-time','25','-H','Cache-Control: no-cache',SITE+'/'+p+'?shimanto='+str(time.time_ns())],capture_output=True)
    if r.returncode:raise RuntimeError('HTTPS read failed '+p)
    return r.stdout
def git(ref,p):return subprocess.check_output(['git','show',ref+':'+p])
def verify_source():
    for p in new+old:
        assert Path(p).read_bytes()==git(SOURCE,p),'source mismatch '+p
def listing(dir):
    raw=ftp(['cls -1 -a '+q(dir+'/')])
    return {line.strip().rstrip('/').rsplit('/',1)[-1] for line in raw.splitlines() if line.strip()}
def check_unused():
    root=listing(ROOT)
    assert set(old+['shimanto','index.html'])<=root,'root listing not confirmed'
    assert 'unified.js' in listing(ROOT+'/shimanto')
    print('FTPS_PATHS_VERIFIED',flush=True)
def current(p,expected):
    assert sha(http(p))==expected,'live digest mismatch '+p
def protected():
    for p in ['isonoura','kounohama','ikumi','komatsu','irago','shizunami','hamadutu','takahama','hakuto']:
        current(p+'.html',sha(git(BASE,p+'.html')))
    current('index.html',home_after)
    current('',home_after)
    for p in ['shimanto/tide/L6-2026.json','shimanto/tide/L6-2027.json','shimanto/tide/TS-2026.json','shimanto/tide/TS-2027.json']:
        current(p,sha(git(BASE,p)))
    current('shimanto/unified.js',sha(git(BASE,'shimanto/unified.js')))
    print('PROTECTED_LEGACY_AND_TIDE_VERIFIED',flush=True)
def preflight():
    verify_source()
    check_unused()
    protected()
    for p in old:current(p,sha(git(BASE,p)))
    for p in old: (backup/p).parent.mkdir(parents=True,exist_ok=True)
    ftp(['get '+q(ROOT+'/'+p)+' -o '+q(backup/p) for p in old])
    for p in old:assert sha((backup/p).read_bytes())==sha(git(BASE,p)),'FTP backup mismatch '+p
    print('BACKUP_VERIFIED_5_FILES',flush=True)
def put(p,local):ftp(['put '+q(local)+' -o '+q(ROOT+'/'+p)])
def publish():
    verify_source()
    check_unused()
    protected()
    for p in old:
        assert sha((backup/p).read_bytes())==sha(git(BASE,p))
        current(p,sha(git(BASE,p)))
    attempted=[]
    try:
        for p in new:
            put(p,p)
            current(p,sha(git(SOURCE,p)))
            print('NEW_VERIFIED',p,flush=True)
        for p in old:
            current(p,sha(git(BASE,p)))
            attempted.append(p)
            put(p,p)
            current(p,sha(git(SOURCE,p)))
            print('UPDATED_VERIFIED',p,flush=True)
        for p in new+old:current(p,sha(git(SOURCE,p)))
        protected()
        print('RELEASE_VERIFIED_5_COASTVIEW_PAGES_PROTECTED_LEGACY',flush=True)
    except Exception:
        for p in reversed(attempted):
            put(p,backup/p)
            current(p,sha(git(BASE,p)))
            print('ROLLBACK_VERIFIED',p,flush=True)
        print('No new paths created; no existing files deleted.',flush=True)
        raise
if sys.argv[1]=='preflight':preflight()
elif sys.argv[1]=='publish':publish()
else:raise RuntimeError('bad mode')
