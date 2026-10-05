package in.joseph.metrosn;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.Color;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Collections;
import java.util.UUID;

public final class MainActivity extends Activity {
    public static final String OPEN_LINK="in.joseph.metrosn.OPEN_LINK", START="in.joseph.metrosn.START";
    private static final int TEAL=Color.rgb(0,125,128);
    private final Handler handler=new Handler(Looper.getMainLooper());
    private TextView status;
    private WebView web;
    private String script;
    private boolean filling;
    private long fillDeadline;
    private int runId;
    private SharedPreferences prefs(){return getSharedPreferences("setup",MODE_PRIVATE);}
    public static String nonce(Context c){
        SharedPreferences p=c.getSharedPreferences("setup",MODE_PRIVATE);String n=p.getString("nonce",null);
        if(n==null){n=UUID.randomUUID().toString();p.edit().putString("nonce",n).apply();}return n;
    }
    public void onCreate(Bundle state){super.onCreate(state);getWindow().setStatusBarColor(TEAL);home();handle(getIntent());}
    protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);handle(intent);}
    private void handle(Intent intent){
        if(intent==null)return;
        if(Intent.ACTION_SEND.equals(intent.getAction())){
            String link=BookingPolicy.extract(intent.getStringExtra(Intent.EXTRA_TEXT));
            if(link==null)notice("Share the original fresh prutech.org booking link from WhatsApp.");else openBooking(link);
        }else if(nonce(this).equals(intent.getStringExtra("nonce"))){
            if(OPEN_LINK.equals(intent.getAction()))openBooking(intent.getStringExtra("link"));
            else if(START.equals(intent.getAction()))startAutomation();
        }
        intent.setAction(null);intent.removeExtra("link");intent.removeExtra(Intent.EXTRA_TEXT);
    }
    private LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);l.setPadding(dp(22),dp(26),dp(22),dp(20));l.setBackgroundColor(Color.rgb(246,250,250));return l;}
    private int dp(int n){return (int)(getResources().getDisplayMetrics().density*n);}
    private TextView label(LinearLayout parent,String text,int size){TextView t=new TextView(this);t.setText(text);t.setTextSize(size);t.setTextColor(Color.rgb(24,49,53));t.setPadding(0,dp(8),0,dp(8));parent.addView(t);return t;}
    private void button(LinearLayout parent,String title,Runnable action){Button b=new Button(this);b.setText(title);b.setAllCaps(false);parent.addView(b,new LinearLayout.LayoutParams(-1,dp(56)));b.setOnClickListener(v->action.run());}
    private void home(){
        stopFill();if(web!=null){web.destroy();web=null;}
        ScrollView scroll=new ScrollView(this);LinearLayout body=column();scroll.addView(body);setContentView(scroll);
        label(body,"METRO TO SN",14);label(body,"Kadavanthra\n→ S N Junction",30);
        label(body,"1 passenger · One way",18);
        status=label(body,"Free personal prototype · No ads or subscriptions",14);
        button(body,"Start my booking",()->startAutomation());
        button(body,"Add home-screen button",()->pinShortcut());
        label(body,"First-time setup",20);
        label(body,"Confirm that +91 9188957488 is your Kochi Metro bot. The helper sends Hi once and taps Book Ticket in the chat named Kochi Metro Rail Limited. It runs only after Start and stops after 90 seconds.",15);
        button(body,"Enable WhatsApp helper",()->new AlertDialog.Builder(this)
            .setTitle("Allow the WhatsApp helper")
            .setMessage("Android Accessibility lets this app read and tap WhatsApp controls. This prototype checks the Kochi Metro chat before acting and does not operate payment apps. The helper does not save chat text or links. The booking website uses normal WebView cookies and storage. There is no analytics or app server. Enable only Metro to SN on the next screen.")
            .setPositiveButton("Open settings",(d,w)->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)))
            .setNegativeButton("Cancel",null).show());
        label(body,"Fallback: share or paste a fresh link",20);
        label(body,"You can skip Accessibility entirely: request the bot link yourself, then share it to Metro to SN. It will fill your route and fetch the fare.",15);
        EditText input=new EditText(this);input.setHint("Paste fresh booking link");input.setSingleLine(true);input.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);body.addView(input);
        button(body,"Open link & fill route",()->{String link=BookingPolicy.extract(input.getText().toString());input.setText("");openBooking(link);});
        label(body,"Stops at fare review. Tap Book Ticket yourself and approve payment. WhatsApp automation and payment compatibility still need testing on your phone.",14);
        button(body,"Stop helper",()->{if(MetroService.instance!=null)MetroService.instance.stop();notice("Helper stopped.");});
    }
    private void startAutomation(){
        if(MetroService.instance==null){notice("Enable the WhatsApp helper first, or use Share link.");return;}
        if(!prefs().getBoolean("authorized",false)){
            new AlertDialog.Builder(this).setTitle("Set up your one-tap booking")
                .setMessage("When you tap Start, allow this app to open +91 9188957488 in WhatsApp, send Hi, tap Book Ticket and fill Kadavanthra → S N Junction for one passenger? Payment remains manual. Confirm the bot number matches your existing chat.")
                .setPositiveButton("Save & start",(d,w)->{prefs().edit().putBoolean("authorized",true).apply();startAutomation();})
                .setNegativeButton("Cancel",null).show();return;
        }
        stopFill();MetroService.instance.arm();
        Intent wa=new Intent(Intent.ACTION_VIEW,Uri.parse("https://wa.me/919188957488?text=Hi")).setPackage("com.whatsapp");
        try{startActivity(wa);}catch(Exception ex){MetroService.instance.stop();notice("WhatsApp could not open. Use Share link instead.");}
    }
    private void pinShortcut(){
        ShortcutManager manager=getSystemService(ShortcutManager.class);
        ShortcutInfo info=new ShortcutInfo.Builder(this,"metro-to-sn").setShortLabel("Metro to SN")
            .setIcon(Icon.createWithResource(this,R.drawable.ic_metro))
            .setIntent(new Intent(this,MainActivity.class).setAction(START).putExtra("nonce",nonce(this))).build();
        manager.setDynamicShortcuts(Collections.singletonList(info));
        if(manager.isRequestPinShortcutSupported())manager.requestPinShortcut(info,null);
        else notice("Long-press the app icon to use the Metro to SN shortcut.");
    }
    private void openBooking(String link){
        if(!BookingPolicy.valid(link)){notice("Use the original fresh https://prutech.org/KMRL/ booking link.");return;}
        if(MetroService.instance!=null)MetroService.instance.stop();
        stopFill();if(web!=null)web.destroy();
        LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(0,dp(24),0,dp(12));
        LinearLayout head=new LinearLayout(this);head.setPadding(dp(12),0,dp(12),0);head.setOrientation(LinearLayout.VERTICAL);body.addView(head);
        status=label(head,"Opening official booking page…",15);
        button(head,"Stop filling / return home",()->{
            if(filling){stopFill();status.setText("Automation stopped. You can finish manually below.");}
            else new AlertDialog.Builder(this).setMessage("Leave this booking page? Keep it open while payment is processing.").setPositiveButton("Leave",(d,w)->home()).setNegativeButton("Stay",null).show();
        });
        web=new WebView(this);body.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(body);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient(){
            public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){
                if(!req.isForMainFrame())return false;
                Uri u=req.getUrl();String scheme=u.getScheme();
                if("https".equals(scheme))return false;
                if("intent".equals(scheme)||"upi".equals(scheme)||"tez".equals(scheme)||"phonepe".equals(scheme)||"paytmmp".equals(scheme)){
                    stopFill();
                    // External payment apps are launched only after the user taps on the payment page.
                    if(!req.hasGesture()){notice("Tap your payment option to open its app.");return true;}
                    try{
                        Intent target="intent".equals(scheme)?Intent.parseUri(u.toString(),Intent.URI_INTENT_SCHEME):new Intent(Intent.ACTION_VIEW,u);
                        Uri paymentData=target.getData();
                        if(paymentData==null||!("upi".equals(paymentData.getScheme())||"tez".equals(paymentData.getScheme())||"phonepe".equals(paymentData.getScheme())||"paytmmp".equals(paymentData.getScheme())||"https".equals(paymentData.getScheme())))throw new Exception();
                        target.setAction(Intent.ACTION_VIEW);target.setComponent(null);target.setSelector(null);target.addCategory(Intent.CATEGORY_BROWSABLE);
                        target.setFlags(0);target.removeExtra("browser_fallback_url");startActivity(target);
                    }catch(Exception ex){notice("This payment option could not open. Choose another option on the page.");}
                    return true;
                }
                return true;
            }
            public void onPageFinished(WebView view,String url){/* The bounded polling loop handles Angular loading. */}
        });
        try{if(script==null){InputStream in=getAssets().open("autofill.js");ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);in.close();script=out.toString("UTF-8");}}
        catch(Exception ex){status.setText("Could not load form helper. Finish manually.");web.loadUrl(link);return;}
        filling=true;fillDeadline=android.os.SystemClock.elapsedRealtime()+95000;int thisRun=++runId;web.loadUrl(link);handler.postDelayed(()->fill(thisRun),600);
    }
    private void fill(int thisRun){
        if(!filling||web==null||thisRun!=runId)return;
        if(android.os.SystemClock.elapsedRealtime()>fillDeadline){stopFill();status.setText("Form timed out. Finish manually or request a fresh link.");return;}
        String url=web.getUrl();Uri uri=url==null?null:Uri.parse(url);
        if(uri==null||"about".equals(uri.getScheme())){handler.postDelayed(()->fill(thisRun),500);return;}
        if(!"https".equals(uri.getScheme())||!"prutech.org".equals(uri.getHost())||!"/KMRL/".equals(uri.getPath())){
            stopFill();status.setText("Form automation ended. Follow the page below; request a fresh link if it expired.");return;
        }
        web.evaluateJavascript(script,value->{
            if(!filling||thisRun!=runId)return;
            // A navigation can briefly return null before the new document is ready.
            if(value==null||"null".equals(value)||"undefined".equals(value)){
                handler.postDelayed(()->fill(thisRun),500);return;
            }
            try{Object parsed=new JSONTokener(value).nextValue();if(!(parsed instanceof JSONObject))throw new Exception();
                JSONObject o=(JSONObject)parsed;status.setText(o.optString("message","Loading…"));
                if(!"wait".equals(o.optString("state"))){stopFill();return;}
            }catch(Exception ex){stopFill();status.setText("The form changed. Please finish manually below.");return;}
            handler.postDelayed(()->fill(thisRun),500);
        });
    }
    private void stopFill(){filling=false;runId++;handler.removeCallbacksAndMessages(null);}
    private void notice(String text){Toast.makeText(this,text,Toast.LENGTH_LONG).show();if(status!=null)status.setText(text);}
    public void onBackPressed(){if(web!=null){new AlertDialog.Builder(this).setMessage("Leave the booking page? Keep it open during payment.").setPositiveButton("Leave",(d,w)->home()).setNegativeButton("Stay",null).show();}else super.onBackPressed();}
    protected void onDestroy(){stopFill();if(web!=null)web.destroy();super.onDestroy();}
}
