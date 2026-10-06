package in.joseph.metrosn;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Experimental, English WhatsApp UI only. Never reads or acts while idle. */
public final class MetroService extends AccessibilityService {
    public static MetroService instance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Set<String> oldLinks = new HashSet<>();
    private int state; // 0 idle, 1 send Hi, 2 wait Book Ticket, 3 wait new link
    private long deadline, changed;
    private boolean enteredChat;
    private final Runnable tick = new Runnable() { public void run() { inspect(); if(state!=0)handler.postDelayed(this,500); } };
    protected void onServiceConnected(){instance=this;}
    public void arm(){stop();state=1;deadline=SystemClock.elapsedRealtime()+90000;changed=SystemClock.elapsedRealtime();handler.postDelayed(tick,600);}
    public void stop(){state=0;enteredChat=false;oldLinks.clear();handler.removeCallbacks(tick);}
    public void onInterrupt(){stop();}
    public void onDestroy(){stop();instance=null;super.onDestroy();}
    public void onAccessibilityEvent(AccessibilityEvent event){/* One polling loop avoids duplicate taps. */}
    private void abort(String reason){stop();Toast.makeText(this,reason,Toast.LENGTH_LONG).show();}
    private void inspect(){
        if(state==0)return;
        long now=SystemClock.elapsedRealtime();
        if(now>deadline){abort("Stopped after 90 seconds. Use Share link → Metro to SN if needed.");return;}
        AccessibilityNodeInfo root=getRootInActiveWindow();
        if(root==null)return;
        if(!"com.whatsapp".contentEquals(root.getPackageName()==null?"":root.getPackageName())){
            if(enteredChat)abort("Stopped because you left WhatsApp.");
            return;
        }
        List<AccessibilityNodeInfo> titles=root.findAccessibilityNodeInfosByViewId("com.whatsapp:id/conversation_contact_name");
        boolean rightChat=false;
        for(AccessibilityNodeInfo n:titles)if("Kochi Metro Rail Limited".equals(text(n)))rightChat=true;
        if(!rightChat){if(enteredChat)abort("Stopped: Kochi Metro chat is no longer open.");return;}
        enteredChat=true;
        List<AccessibilityNodeInfo> nodes=new ArrayList<>();collect(root,nodes);
        if(state==1){
            for(AccessibilityNodeInfo n:nodes){String link=BookingPolicy.extract(text(n));if(link!=null)oldLinks.add(link);}
            boolean hiReady=false;
            for(AccessibilityNodeInfo n:nodes)if(n.isEditable()&&"Hi".equals(text(n)))hiReady=true;
            if(!hiReady)return; // Never overwrite a draft or type into a guessed control.
            AccessibilityNodeInfo send=null;
            for(AccessibilityNodeInfo n:nodes)if(n.isEnabled()&&n.isClickable()&&"Send".equals(desc(n)))send=n;
            if(send==null)return;
            state=2;changed=now; // Advance before the click; no automatic retry can send twice.
            if(!send.performAction(AccessibilityNodeInfo.ACTION_CLICK))abort("Could not press Send. Finish in WhatsApp, then share the link.");
            return;
        }
        // Remember older links until the Book Ticket action is sent.
        if(state==2)for(AccessibilityNodeInfo n:nodes){String link=BookingPolicy.extract(text(n));if(link!=null)oldLinks.add(link);}
        if(state==3)for(int i=nodes.size()-1;i>=0;i--){String link=BookingPolicy.extract(text(nodes.get(i)));
            if(link!=null&&!oldLinks.contains(link)){
                stop();Intent open=new Intent(this,MainActivity.class).setAction(MainActivity.OPEN_LINK)
                    .putExtra("link",link).putExtra("nonce",MainActivity.nonce(this))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(open);return;
            }
        }
        if(state!=2||now-changed<1500)return;
        AccessibilityNodeInfo book=null;int bottom=-1;
        for(AccessibilityNodeInfo n:nodes){
            String label=text(n);
            if(!"Book Ticket".equals(label))label=desc(n);
            if(!"Book Ticket".equals(label)||!n.isVisibleToUser()||!n.isEnabled())continue;

            // WhatsApp has changed the accessibility class used for bot reply buttons across
            // releases. Match the exact visible label, then walk only a few ancestors to find
            // its clickable container instead of requiring the class/resource name to contain
            // the word "button".
            AccessibilityNodeInfo clickable=n;
            for(int depth=0;depth<4 && clickable!=null && !clickable.isClickable();depth++)clickable=clickable.getParent();
            if(clickable==null||!clickable.isClickable()||!clickable.isEnabled()||!clickable.isVisibleToUser())continue;

            Rect r=new Rect();n.getBoundsInScreen(r);if(r.bottom>bottom){bottom=r.bottom;book=clickable;}
        }
        if(book!=null){state=3;changed=now;if(!book.performAction(AccessibilityNodeInfo.ACTION_CLICK))abort("Could not tap Book Ticket. Tap it yourself, then share the link.");}
    }
    private static String text(AccessibilityNodeInfo n){return n.getText()==null?"":n.getText().toString().trim();}
    private static String desc(AccessibilityNodeInfo n){return n.getContentDescription()==null?"":n.getContentDescription().toString().trim();}
    private static void collect(AccessibilityNodeInfo n,List<AccessibilityNodeInfo> out){
        if(n==null||out.size()>=2000)return;out.add(n);
        for(int i=0;i<n.getChildCount();i++)collect(n.getChild(i),out);
    }
}
