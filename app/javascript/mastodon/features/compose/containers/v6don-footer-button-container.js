import { connect } from 'react-redux';
import TextIconButton from '../components/text_icon_button';

const mapStateToProps = (state) => ({
  label: 'FT',
  title: '実況用フッタ',
  active: state.getIn(['compose', 'v6don_footer']),
});

const mapDispatchToProps = dispatch => ({

  onClick () {
    dispatch({ type: 'COMPOSE_V6DON_FOOTER_CHANGE' });
  },

});

export default connect(mapStateToProps, mapDispatchToProps)(TextIconButton);
