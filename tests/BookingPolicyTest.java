package in.joseph.metrosn;
public final class BookingPolicyTest {
  public static void main(String[] args) {
    String good="https://prutech.org/KMRL/#/manage/ticket/Ab12Cd34";
    if(!BookingPolicy.valid(good))throw new AssertionError("valid link rejected");
    if(!good.equals(BookingPolicy.extract("Book here: "+good+"\nThanks")))throw new AssertionError("message extraction");
    String[] bad={"http://prutech.org/KMRL/#/manage/ticket/Ab12Cd34","https://evil.org/KMRL/#/manage/ticket/Ab12Cd34",good+"/extra",good+"?next=https://evil.org",good+".evil.org",good+"#extra","https://prutech.org/KMRL/#/manage/ticket/booked","https://prutech.org.evil.org/KMRL/#/manage/ticket/Ab12Cd34","https://evil.org/?u="+good};
    for(String value:bad)if(BookingPolicy.extract(value)!=null)throw new AssertionError("accepted "+value);
    System.out.println("URL policy: valid link + message accepted; 9 unsafe/stale URL shapes rejected.");
  }
}
