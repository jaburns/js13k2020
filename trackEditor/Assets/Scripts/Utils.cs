static public class Utils
{
    static public string SmallNum( float x, bool keepPeriod = false )
    {
        var d = System.Convert.ToDecimal( x );
        var result = System.Math.Round( d, 3 ).ToString();

        while( result.Contains(".") && result.EndsWith("0") || result.EndsWith(".") )
            result = result.Substring( 0, result.Length - 1 );

        result = result.Length == 0 ? "0" : result;

        if( keepPeriod && !result.Contains(".") )
			result += ".";

        return result;
    }
}