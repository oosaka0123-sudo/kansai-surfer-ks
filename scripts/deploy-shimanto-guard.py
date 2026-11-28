import os,sys,pathlib,subprocess,hashlib,time,json
from pathlib import Path
SITE='https://kansai.rss7.net'
ROOT='/kansai'
HOST='ftp.lolipop.jp'
BASE='26e03ba51356ecd08f73f860f8607658cb242eac'
SOURCE='bfee3c60e61d7eadeb14c3bb1096cc315b2f0032'
old=[s+'.html' for s in ['isonoura','kounohama','ikumi','komatsu','irago','shizunami','hamadutu','takahama','hakuto']]+['index.html']
new=['shimanto/preview.css','shimanto/preview.js','shimanto/tide.js','shimanto/tide/L6-2026.json','shimanto/tide/L6-2027.json','shimanto/tide/TS-2026.json','shimanto/tide/TS-2027.json','ukibuchi.html','irino.html','futami.html','hirano.html','oki.html']
home_hash='9fbafddc3ef123952ee14584683672d843e19d782e6a595a079b2083d6290e50'
home_after='4b82f4103f68e0c3b3f009d878230b5fd05ea4e9a30904b8e51c049a838b1906'
tmp=Path(os.environ['RUNNER_TEMP'])/'shimanto-release'
backup=tmp/'backup'
stage=tmp/'stage'
for x in [backup,stage]:x.mkdir(parents=True,exist_ok=True)
assert os.environ['GITHUB_REF']=='refs/heads/ops/shimanto-preview-178'
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
    for p in new+old[:-1]:
        assert Path(p).read_bytes()==git(SOURCE,p),'source mismatch '+p
def check_unused():
    listing=ftp(['cls -1 -a '+q(ROOT+'/')])
    names={line.strip().rstrip('/').rsplit('/',1)[-1] for line in listing.splitlines() if line.strip()}
    assert set(old)<=names,'root listing not confirmed'
    assert not ({p for p in new if '/' not in p}|{'shimanto'}) & names,'new path collision'
    print('FTPS_ROOT_AND_NEW_PATHS_VERIFIED',flush=True)
def expected_old(p):return home_hash if p=='index.html' else sha(git(BASE,p))
def expected_new(p):return home_after if p=='index.html' else sha(git(SOURCE,p))
def current(p,expected):
    assert sha(http(p))==expected,'live digest mismatch '+p
    if p=='index.html':assert sha(http(''))==expected,'root digest mismatch'
def preflight():
    verify_source()
    check_unused()
    for p in old:
        current(p,expected_old(p))
    ftp(['get '+q(ROOT+'/'+p)+' -o '+q(backup/p) for p in old])
    for p in old:assert sha((backup/p).read_bytes())==expected_old(p),'FTP backup mismatch '+p
    subprocess.run(['node','scripts/patch-home-shimanto.cjs',str(backup/'index.html'),str(stage/'index.html'),home_hash],check=True)
    assert sha((stage/'index.html').read_bytes())==home_after
    print('BACKUP_VERIFIED_10_FILES',flush=True)
def put(p,local):ftp(['put '+q(local)+' -o '+q(ROOT+'/'+p)])
def publish():
    verify_source()
    check_unused()
    for p in old:
        assert sha((backup/p).read_bytes())==expected_old(p)
        current(p,expected_old(p))
    attempted=[]
    try:
        ftp(['mkdir '+q(ROOT+'/shimanto'),'mkdir '+q(ROOT+'/shimanto/tide')])
        for p in new:
            put(p,p)
            current(p,expected_new(p))
            print('NEW_VERIFIED',p,flush=True)
        for p in old:
            current(p,expected_old(p))
            attempted.append(p)
            put(p,stage/p if p=='index.html' else p)
            current(p,expected_new(p))
            print('UPDATED_VERIFIED',p,flush=True)
        for p in new+old:current(p,expected_new(p))
        print('RELEASE_VERIFIED_22_FILES_AND_ROOT',flush=True)
    except Exception:
        for p in reversed(attempted):
            put(p,backup/p)
            current(p,expected_old(p))
            print('ROLLBACK_VERIFIED',p,flush=True)
        print('New preview files if uploaded remain unlinked; no existing files deleted.',flush=True)
        raise
if sys.argv[1]=='preflight':preflight()
elif sys.argv[1]=='publish':publish()
else:raise RuntimeError('bad mode')
